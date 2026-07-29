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
import { DEFAULT_RENDER_TIMEOUT_MS, enqueuePdfJob, pdfJobStats } from '@/lib/temario/pdf/pdfJobQueue'
import { runPdfWorker, type EmitFn, type RenderFn } from '@/lib/temario/pdf/pdfWorker'
import { PDF_TEMPLATE_VERSION } from '@/lib/temario/pdf/pdfCache'

const PDF_MAX_CHARS = 400_000       // límite de generación síncrona (total del tema)
const PDF_MAX_ARTICLE_CHARS = 60_000 // límite por-artículo (cajón)
// Timeout por render: se mata el hijo y el job va a retry/DLQ (no bloquea la cola).
// El valor NO se declara aquí: vive junto a `DEFAULT_STALE_SECONDS`, con el que
// mantiene un invariante (el rescate de 'running' colgados tiene que llegar DESPUÉS
// del techo, o re-encolaría un render en curso). Tenerlos en ficheros distintos es
// como se descalibró: el techo se subía sin mirar el rescate.
const RENDER_TIMEOUT_MS = DEFAULT_RENDER_TIMEOUT_MS

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

/**
 * Nombre del job para la liveness de crons. DEBE coincidir EXACTO con la entrada de
 * `EXTERNAL_SCHEDULED_JOBS` en `backend/src/cron-schedule/external-jobs.registry.ts`:
 * la regla `cron_overdue` une catálogo y señales por este string. Lo fija el
 * guardarraíl `__tests__/guardrails/externalScheduledJobs.test.ts`.
 */
const JOB_NAME = 'temario-pdf-worker'

/**
 * Señal de LIVENESS del job, con el mismo contrato que `runWithHeartbeat` da a los
 * @Cron in-process: `cron_tick` al arrancar y `cron_run` al terminar, ambos con
 * `endpoint = JOB_NAME`. Sin esto el worker es invisible para `cron_overdue` — que es
 * exactamente lo que pasó del 27 al 29/07: la tarea programada dejó de arrancar (su
 * imagen había sido purgada del registry) y nadie se enteró en 2 días, porque un job
 * que muere antes del entrypoint no puede avisar de su propia muerte. La única señal
 * posible es la AUSENCIA de estas dos.
 *
 * Se hace `await` (no fire-and-forget): `main()` cierra la conexión al salir y un
 * INSERT sin esperar se perdería justo en la señal que sostiene la alerta.
 */
async function emitCronSignal(
  db: any,
  eventType: 'cron_tick' | 'cron_run',
  opts: { ms?: number; status?: string; error?: string } = {},
): Promise<void> {
  const meta = JSON.stringify(
    eventType === 'cron_tick' ? { phase: 'start' } : { status: opts.status ?? 'success' },
  )
  try {
    await db.execute(sql`
      INSERT INTO observable_events (source, severity, event_type, endpoint, duration_ms, error_message, metadata)
      VALUES ('worker', ${opts.error ? 'error' : 'debug'}, ${eventType}, ${JOB_NAME},
        ${opts.ms ?? null}, ${opts.error ?? null}, ${meta}::jsonb)
    `)
  } catch {
    // La observabilidad nunca tumba el job. Si se pierde el tick, el `cron_run`
    // de completado actúa de fallback (la regla lee ambos).
  }
}

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
    // Firma = versión de plantilla + tamaño. Incluir PDF_TEMPLATE_VERSION hace el sistema
    // AUTO-CURABLE ante un bump de plantilla: al cambiar la versión, la firma cambia → job nuevo →
    // el worker regenera (antes el bump invalidaba la caché S3 pero el encolado no se enteraba y los
    // temas grandes quedaban colgados en window.print()). El tamaño re-detecta cambios de contenido.
    const sig = `sweep:${PDF_TEMPLATE_VERSION}:${total}:${maxArt}`
    // Idempotencia REAL (evita churn cada ciclo del worker): el índice `_alive_uq` solo cubre jobs
    // VIVOS, así que un job 'done' NO frena un re-encolado. Comprobamos aquí si ya existe un job
    // con ESTA firma exacta en CUALQUIER estado (incl. 'done'/'failed'); si sí, esta versión ya
    // está hecha (o en cola/DLQ) → no reencolar. Solo entra lo cuya firma es NUEVA (bump de
    // plantilla o cambio de tamaño). Consulta indexada barata.
    const existing = (await db.execute(sql`
      SELECT count(*)::int AS n FROM temario_pdf_jobs
      WHERE oposicion = ${pt} AND tema = ${tema} AND content_hash = ${sig}
    `)) as { n: number }[]
    if (Number(existing[0]?.n ?? 0) > 0) { dup++; continue }
    const ins = await enqueuePdfJob(db, { oposicion: pt, tema, contentHash: sig })
    if (ins) { enq++; console.log(`  + ${pt} T${tema} (total ${(total/1000).toFixed(0)}k, art ${(maxArt/1000).toFixed(0)}k)`) }
    else dup++
  }
  console.log(`✅ encolados ${enq}, ya al día ${dup}`)
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
    else if (cmd === 'drain') {
      // `drain` es lo que invoca el scheduler → es el tick que la liveness vigila.
      // El tick va ANTES de cualquier trabajo: mide "¿arrancó el job?", no "¿terminó?".
      // Una cola vacía es un ciclo perfectamente sano y debe emitir señal igual, o el
      // silencio de un worker sano sería indistinguible del de uno muerto.
      const t0 = Date.now()
      await emitCronSignal(db, 'cron_tick')
      try {
        // RECONCILIADOR (estado deseado): antes de drenar, asegura que la cola tenga jobs para los
        // temas grandes cuya firma (versión de plantilla + tamaño) cambió → un bump de plantilla o un
        // tema nuevo/editado se regenera SOLO, sin intervención. Los ya al día se deduplican (barato,
        // sin fetch de contenido ni HEAD a S3). Así el worker programado auto-cura cada ciclo.
        await cmdEnqueueBig(db, PDF_MAX_CHARS, PDF_MAX_ARTICLE_CHARS)
        await cmdDrain(db, Number(a) || Number.MAX_SAFE_INTEGER)
        await emitCronSignal(db, 'cron_run', { ms: Date.now() - t0, status: 'success' })
      } catch (e) {
        // Un ciclo que peta SÍ anuncia que terminó: sin `cron_run` la regla
        // `cron_started_not_finished` lo leería como "arrancó y se colgó", que es
        // un diagnóstico distinto. El error se propaga igual.
        await emitCronSignal(db, 'cron_run', {
          ms: Date.now() - t0,
          status: 'failure',
          error: e instanceof Error ? e.message : String(e),
        })
        throw e
      }
    }
    else if (cmd === 'stats') console.log('📊', await pdfJobStats(db))
    else { console.error('uso: enqueue-big [minTotal minArt] | drain [maxJobs] | stats'); process.exitCode = 2 }
  } finally {
    await conn.end()
  }
}

main().catch((e) => { console.error('💥', e); process.exit(1) })
