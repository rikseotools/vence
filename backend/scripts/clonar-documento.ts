/**
 * clonar-documento.ts — CAPA 2 del sistema de convocatorias: clonar un documento oficial al corpus.
 *
 * Runbook: docs/runbooks/verificar-convocatorias.md
 *
 * POR QUÉ ES UNA HERRAMIENTA Y NO UN CRON: elegir QUÉ documento es el bueno requiere criterio. Un
 * crawler por regex no distingue las bases de un PDF titulado "previsión de plazas a convocar" —cuyas
 * cifras NO son las de esta convocatoria— y clonar sin discriminar envenena la extracción por
 * construcción. Por eso el documento entra al corpus cuando Claude lo ha discriminado: `curado=true`.
 *
 * SOPORTA PDF **Y HTML** (16/07): de las 112 urls de documento que conocemos solo 19 son .pdf; las 20
 * del BOE son HTML. Un corpus que solo lee PDF es ciego a la mayoría de las fuentes. Se reutiliza
 * `htmlToText()` del sensor — sin parseo nuevo.
 *
 * Uso (desde backend/):
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/clonar-documento.ts \
 *     --slug=administrativo-madrid --url=https://... --tipo=bases \
 *     --titulo="Orden 1634/2026 — bases" --boletin=BOCM --ref=BOCM-20260714-6 --fecha=2026-07-14
 *
 * Idempotente por (convocatoria_id, url, content_hash): re-clonar un documento sin cambios no
 * duplica; si el boletín lo ENMIENDA, el hash cambia → fila nueva, que es justo lo que queremos para
 * las correcciones de errores.
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
for (const p of ['.env.local', '../.env.local']) {
  if (fs.existsSync(path.resolve(p))) { dotenv.config({ path: path.resolve(p) }); break }
}
import { Client } from 'pg'
import * as crypto from 'crypto'
import { htmlToText } from '../src/detect-notas-convocatoria/notas-extract'

const MAX_BYTES = 8 * 1024 * 1024

const arg = (n: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3)

/** Descarga y extrae texto: PDF o HTML. Devuelve null y DICE POR QUÉ si no puede (nunca en silencio). */
export async function extraerTexto(url: string): Promise<{ texto: string; formato: 'pdf' | 'html' } | null> {
  const res = await fetch(url, { headers: { 'User-Agent': 'VenceBot/1.0' } })
  if (!res.ok) {
    console.error(`✗ HTTP ${res.status}${res.status === 403 || res.status === 429 ? ' (el boletín bloquea al bot)' : ''}`)
    return null
  }
  const ct = res.headers.get('content-type') ?? ''
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) { console.error(`✗ ${(buf.length / 1024 / 1024).toFixed(1)} MB > 8 MB`); return null }

  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') {
    // @ts-expect-error: 'pdf-parse/lib/pdf-parse.js' no trae tipos (mismo patrón que el servicio).
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (b: Buffer) => Promise<{ text: string }>
    return { texto: (await pdfParse(buf)).text ?? '', formato: 'pdf' }
  }
  if (/html/i.test(ct)) return { texto: htmlToText(buf.toString('utf-8')), formato: 'html' }
  console.error(`✗ ni PDF ni HTML (content-type: ${ct || 'desconocido'})`)
  return null
}

async function main() {
  const slug = arg('slug'), url = arg('url'), tipo = arg('tipo') ?? 'otro'
  if (!slug || !url) {
    console.error('faltan --slug y --url. Ver la cabecera del fichero.')
    process.exit(1)
  }
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()

  // El documento cuelga del CICLO, no de la oposición: un documento pertenece a una convocatoria.
  //
  // --anio: sin él solo se podía documentar el ciclo VIGENTE, y los archivados se quedaban sin prueba
  // para siempre. Al hacer el rollover de la AGE (16/07) el ciclo 2025 —con su Resolución de
  // 18/12/2025, que es justo la que demuestra sus 1.700 plazas— quedó inalcanzable para esta
  // herramienta. Y la regla es que CADA convocatoria tenga sus documentos, no solo la que vende hoy:
  // la prueba del ciclo viejo es lo que permite auditar el nuevo (de ahí salió que el 1.450 era de
  // 2026 y estaba metido en la fila de 2025).
  const anio = arg('anio')
  const cv = (await c.query(
    anio
      ? `SELECT c.id, c."año" FROM convocatorias c JOIN oposiciones o ON o.id = c.oposicion_id
          WHERE o.slug = $1 AND c."año" = $2`
      : `SELECT c.id, c."año" FROM convocatorias c JOIN oposiciones o ON o.id = c.oposicion_id
          WHERE o.slug = $1 AND c.is_current`,
    anio ? [slug, Number(anio)] : [slug])).rows[0]
  if (!cv) {
    console.error(anio
      ? `✗ ${slug} no tiene ciclo del año ${anio}`
      : `✗ ${slug} no tiene convocatoria vigente: no hay ciclo del que colgar el documento`)
    process.exit(1)
  }

  const r = await extraerTexto(url)
  if (!r) process.exit(1)
  if (r.texto.trim().length < 200) { console.error(`✗ solo ${r.texto.length} chars: ¿PDF escaneado o página vacía?`); process.exit(1) }

  const hash = crypto.createHash('sha256').update(r.texto).digest('hex')
  const ins = await c.query(
    `INSERT INTO convocatoria_documentos (convocatoria_id, tipo, url, titulo, boletin, referencia,
       fecha_publicacion, content_hash, extracted_text, fuente, fetched_at, curado, curado_por, curado_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'manual',now(),true,'claude',now())
     ON CONFLICT DO NOTHING RETURNING id`,
    [cv.id, tipo, url, arg('titulo') ?? url.split('/').pop(), arg('boletin') ?? null,
     arg('ref') ?? null, arg('fecha') ?? null, hash, r.texto])

  console.log(ins.rows[0]
    ? `✅ clonado y CURADO: ${(r.texto.length / 1024).toFixed(0)} KB (${r.formato}) → ${slug}`
    : `↷ ya estaba en el corpus con el mismo hash (idempotente): ${slug}`)
  await c.end()
}

if (require.main === module) main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
