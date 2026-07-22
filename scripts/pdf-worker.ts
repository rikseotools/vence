// scripts/pdf-worker.ts — entrypoint del WORKER de generación de PDFs del temario (T-086 Fase D).
//
// Corre FUERA de las tasks de serving (sin ALB → sin health checks → el render tarda lo que haga
// falta; medido: un cajón de 91k tarda ~72 s y ~1,4 GB, imposible en una task que sirve). Ejecútalo
// como script/cron/task dedicada. Reusa el pipeline real (@react-pdf) vía pregenerateTopicPdf.
//
//   tsx -r tsconfig-paths/register scripts/pdf-worker.ts enqueue-big [minTotal] [minArt]
//   tsx -r tsconfig-paths/register scripts/pdf-worker.ts drain [maxJobs]
//   tsx -r tsconfig-paths/register scripts/pdf-worker.ts stats
//
// Env: DATABASE_URL, AWS_* (o AWS_PROFILE) para la subida a S3.

import { spawn } from 'node:child_process'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'
import { OPOSICIONES } from '@/lib/api/temario/schemas'
import { enqueuePdfJob, pdfJobStats } from '@/lib/temario/pdf/pdfJobQueue'
import { runPdfWorker, type EmitFn, type RenderFn } from '@/lib/temario/pdf/pdfWorker'

const PDF_MAX_CHARS = 400_000       // límite de generación síncrona (total del tema)
const PDF_MAX_ARTICLE_CHARS = 60_000 // límite por-artículo (cajón)
// Timeout por render. Un tema gigante legítimo (1,3 MB) tarda ~10-13 min; por encima de esto
// asumimos patológico/colgado → se mata el hijo y el job va a retry/DLQ (no bloquea la cola).
const RENDER_TIMEOUT_MS = 18 * 60_000

function makeDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL no definida')
  const conn = postgres(url, { ssl: { rejectUnauthorized: false }, max: 4, prepare: false, connect_timeout: 30 })
  return { db: drizzle(conn) as any, conn }
}

// position_type → slug (1:1 verificado). Para mapear el resultado del barrido (que agrupa por
// position_type) al slug que consume pregenerate.
const PT_TO_SLUG: Record<string, string> = {}
for (const [slug, o] of Object.entries(OPOSICIONES)) PT_TO_SLUG[(o as any).positionType] = slug

/** Emite a observable_events por INSERT directo (el worker es un proceso aparte, no el runtime
 * frontend → esquiva el bug del sink de emitFireAndForget). */
function makeEmit(db: any): EmitFn {
  return (e) => {
    const meta = JSON.stringify({ outcome: e.outcome, oposicion: e.oposicion, tema: e.tema, jobId: e.jobId, attempts: e.attempts, bytes: e.bytes })
    void db.execute(sql`
      INSERT INTO observable_events (source, severity, event_type, endpoint, duration_ms, error_message, metadata)
      VALUES ('worker', ${e.severity}, 'temario_pdf_pregenerated', 'scripts/pdf-worker.ts', ${e.ms ?? null}, ${e.error ?? null},
        ${meta}::jsonb)
    `).catch(() => {})
  }
}

/** Temas que NO caben en generación síncrona (total>400k o algún artículo>60k) → necesitan worker. */
async function bigTopics(db: any, minTotal: number, minArt: number): Promise<{ pt: string; tema: number; total: number; maxArt: number }[]> {
  const rows: any[] = await db.execute(sql`
    SELECT t.position_type AS pt, t.topic_number AS tema,
           sum(length(a.content))::bigint AS total, max(length(a.content))::int AS max_art
    FROM topics t
    JOIN topic_scope ts ON ts.topic_id = t.id
    JOIN articles a ON a.law_id = ts.law_id AND a.is_active
      AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    WHERE t.is_active AND t.disponible
    GROUP BY t.position_type, t.topic_number
    HAVING sum(length(a.content)) > ${minTotal} OR max(length(a.content)) > ${minArt}
    ORDER BY max(length(a.content)) DESC
  `)
  // La cola se keyea por position_type (clave nativa de topics/topic_scope → el trigger del hook la
  // usa sin mapeo SQL). Solo encolamos position_types con slug conocido (el worker mapea a slug al
  // renderizar). Ver migración del hook.
  const out: { pt: string; tema: number; total: number; maxArt: number }[] = []
  for (const r of rows) {
    if (PT_TO_SLUG[r.pt]) out.push({ pt: r.pt, tema: Number(r.tema), total: Number(r.total), maxArt: Number(r.max_art) })
  }
  return out
}

async function cmdEnqueueBig(db: any, minTotal: number, minArt: number) {
  const temas = await bigTopics(db, minTotal, minArt)
  console.log(`📋 ${temas.length} temas grandes (total>${minTotal} o art>${minArt}). Encolando…`)
  let enq = 0, dup = 0
  for (const { pt, tema, total, maxArt } of temas) {
    // Clave de idempotencia = firma de tamaño (cambia si cambia el contenido → re-detecta). NO
    // fetcheamos el contenido aquí (lento); el worker calcula el hash real del S3 al renderizar.
    const sig = `sweep:${total}:${maxArt}`
    const ins = await enqueuePdfJob(db, { oposicion: pt, tema, contentHash: sig })
    if (ins) { enq++; console.log(`  + ${pt} T${tema} (total ${(total/1000).toFixed(0)}k, art ${(maxArt/1000).toFixed(0)}k)`) }
    else dup++
  }
  console.log(`✅ encolados ${enq}, ya-vivos ${dup}`)
}

/**
 * Render en PROCESO HIJO killeable: el render de @react-pdf es CPU-bound y bloquea el event loop;
 * un Promise.race en el mismo proceso no lo interrumpiría y su memoria (hasta ~3 GB en temas de
 * 1,3 MB) no se acota. En un hijo: el loop del worker queda responsivo, el timeout MATA el hijo
 * (SIGKILL libera CPU+RAM) y el job va a retry/DLQ. Aísla cada render → un tema patológico no
 * tumba ni ralentiza la cola. El hijo es scripts/pdf-local.ts full (mismo pipeline).
 */
function childRender(timeoutMs: number): RenderFn {
  return (oposicion, tema, opts) => new Promise((resolve) => {
    const t0 = Date.now()
    // La cola keyea por position_type; pdf-local/pregenerate/S3/route usan el SLUG. Mapeamos aquí
    // (tolerante: si ya viniera un slug, se usa tal cual → compatible con jobs viejos).
    const slug = PT_TO_SLUG[oposicion] ?? oposicion
    const child = spawn(
      'node_modules/.bin/tsx',
      ['-r', 'tsconfig-paths/register', 'scripts/pdf-local.ts', 'full', slug, String(tema), opts?.force ? '1' : '0'],
      { env: process.env },
    )
    let out = ''
    const timer = setTimeout(() => { child.kill('SIGKILL') }, timeoutMs)
    child.stdout.on('data', (d) => { out += d })
    child.stderr.on('data', (d) => { out += d })
    child.on('exit', (code, signal) => {
      clearTimeout(timer)
      const ms = Date.now() - t0
      if (signal === 'SIGKILL') return resolve({ ok: false, outcome: 'timeout', error: `render_timeout_${timeoutMs}ms`, ms })
      if (code === 0) {
        const bytes = out.match(/bytes=(\d+)/)
        const oc = out.match(/outcome=(\w+)/) // 'uploaded' (renderizado) o 'skipped' (ya en caché)
        return resolve({ ok: true, outcome: oc ? oc[1] : 'uploaded', bytes: bytes ? Number(bytes[1]) : undefined, ms })
      }
      resolve({ ok: false, outcome: 'error', error: (out.match(/error=(.+)$/m)?.[1] || out.trim().split('\n').pop() || `exit_${code}`).slice(0, 300), ms })
    })
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, outcome: 'error', error: `spawn: ${e.message}`, ms: Date.now() - t0 }) })
  })
}

async function cmdDrain(db: any, maxJobs: number) {
  console.log(`⚙️  drenando la cola (max ${maxJobs}, timeout/render ${RENDER_TIMEOUT_MS / 60000} min, render en proceso hijo)…`)
  const summary = await runPdfWorker(
    { db, render: childRender(RENDER_TIMEOUT_MS), emit: makeEmit(db) },
    { maxJobs },
  )
  console.log(`✅ procesados ${summary.processed} | done ${summary.done} | retry ${summary.retried} | DLQ ${summary.failed} | rescatados ${summary.rescued}`)
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2)
  const { db, conn } = makeDb()
  try {
    if (cmd === 'enqueue-big') await cmdEnqueueBig(db, Number(a) || PDF_MAX_CHARS, Number(b) || PDF_MAX_ARTICLE_CHARS)
    else if (cmd === 'drain') await cmdDrain(db, Number(a) || Number.MAX_SAFE_INTEGER)
    else if (cmd === 'stats') console.log('📊', await pdfJobStats(db))
    else { console.error('uso: enqueue-big [minTotal minArt] | drain [maxJobs] | stats'); process.exitCode = 2 }
  } finally {
    await conn.end()
  }
}

main().catch((e) => { console.error('💥', e); process.exit(1) })
