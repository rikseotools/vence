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
 * Para páginas SPA (el JS pinta el contenido; el fetch plano solo trae el chrome del portal):
 *     … --headless --wait-for="main .convocatoria-detalle"
 *   `--headless` renderiza con la Lambda `vence-backend-headless-fetcher`; `--wait-for` es el selector
 *   CSS que la Lambda espera antes de devolver (el dato de una SPA aparece tras `networkidle0`). El
 *   resultado pasa por el MISMO `esParedDelPortal()`: un menú renderizado se rechaza igual que uno
 *   plano. NOTA medida: la Lambda NO cura bloqueos por IP — `sede.gva.es` da ERR_CONNECTION_TIMED_OUT
 *   (bloquea AWS); `euskadi.eus` y `sede.madrid.es` sí renderizan.
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

/**
 * ¿Esto es una pared del portal disfrazada de documento?
 *
 * ⚠️ CASO REAL (16/07): tras varias descargas seguidas, el BORM empezó a devolver **HTTP 200** con una
 * «Radware Captcha Page» («your activity and behavior on this site made us think that you are a bot»).
 * 711 caracteres → pasaba de sobra el único filtro que había (`< 200 chars`) y se habría clonado como
 * si fuera la convocatoria, con su `curado`, su hash y su cita. Un corpus con captchas dentro es peor
 * que un corpus vacío: mentiría con pinta de prueba.
 *
 * Mismo patrón que el DOCM redirigiendo a los menús del portal: **200 no significa documento**.
 */
export function esParedDelPortal(texto: string): string | null {
  const t = texto.slice(0, 4000).toLowerCase()
  if (/captcha|are you a robot|you are a bot|verifique que no es un robot/.test(t)) return 'captcha / anti-bot'
  if (/acceso denegado|access denied|forbidden|403 error/.test(t)) return 'acceso denegado'
  if (/demasiadas (peticiones|solicitudes)|too many requests|rate limit/.test(t)) return 'rate limit'
  // El chrome de un portal: mucho menú y nada de norma (el DOCM sin /portaldocm/ daba justo esto).
  if (texto.length < 4000 && /b[úu]squeda avanzada|mapa web|pol[íi]tica de cookies/.test(t)
      && !/resoluci[óo]n|decreto|orden|convoca|plazas/.test(t)) return 'chrome del portal (sin norma)'
  return null
}

/**
 * Fetch RENDERIZADO por la Lambda headless (`vence-backend-headless-fetcher`, Puppeteer+Chromium) para
 * páginas SPA cuyo contenido pinta el JS en cliente y el fetch plano solo trae el chrome del portal.
 *
 * ⚠️ Dos cosas MEDIDAS (17/07), no supuestas:
 *   1. **La Lambda funciona, pero no contra todos los sitios.** `example.com`, `euskadi.eus`,
 *      `sede.madrid.es` y el BOJA renderizan bien; **`sede.gva.es` da `ERR_CONNECTION_TIMED_OUT`**
 *      (bloquea el rango de IPs de AWS). Headless NO cura un bloqueo por IP: solo cura el render en
 *      cliente. Si el sitio bloquea AWS, el resultado es `ok:false` con error de conexión → null aquí.
 *   2. **200 + HTML renderizado ≠ documento.** La Moncloa devolvía 4.204 chars de MENÚS y aun así
 *      `ok:true`. Por eso el resultado de headless pasa por el MISMO `esParedDelPortal()` que el plano
 *      (en main): un menú renderizado se rechaza igual. Ver [[feedback-verificar-el-arreglo-no-declararlo]].
 *
 * `waitFor`: selector CSS que la Lambda espera antes de devolver (el contenido de una SPA aparece
 * DESPUÉS de `networkidle0`). Sin él, se arriesga a devolver el shell vacío. Dalo siempre que sepas
 * qué nodo marca "ya cargó el dato".
 */
async function fetchViaHeadless(
  url: string,
  waitFor?: string,
): Promise<{ texto: string; formato: 'html' } | null> {
  const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda')
  // En PROD (Fargate) el task role ya puede invocar la Lambda → cadena de credenciales por defecto.
  // En LOCAL, `.env.local` inyecta las claves de `vence-storage-writer`, que NO tiene
  // `lambda:InvokeFunction` (medido 17/07). Para usar el tool en local, exporta
  // HEADLESS_FETCHER_PROFILE=vence (un perfil de ~/.aws/credentials que sí puede invocar).
  const profile = process.env.HEADLESS_FETCHER_PROFILE
  const clientOpts: { region: string; credentials?: unknown } = { region: process.env.AWS_REGION ?? 'eu-west-2' }
  if (profile) {
    // credential-provider-ini viene como transitiva del SDK (no es dep nueva).
    const { fromIni } = await import('@aws-sdk/credential-provider-ini')
    clientOpts.credentials = fromIni({ profile })
  }
  const client = new LambdaClient(clientOpts as never)
  const fn = process.env.HEADLESS_FETCHER_FUNCTION_NAME ?? 'vence-backend-headless-fetcher'
  const payload: Record<string, unknown> = { url, timeout_ms: 50_000 }
  if (waitFor) payload.wait_for = waitFor
  const resp = await client.send(new InvokeCommand({
    FunctionName: fn,
    InvocationType: 'RequestResponse',
    Payload: Buffer.from(JSON.stringify(payload)),
  }))
  if (!resp.Payload) { console.error('✗ headless: payload vacío de la Lambda'); return null }
  const parsed = JSON.parse(Buffer.from(resp.Payload).toString('utf-8')) as {
    ok: boolean; status: number; html: string | null; error?: string; render_time_ms?: number
  }
  if (!parsed.ok || parsed.html == null) {
    console.error(`✗ headless: ${parsed.error ?? `status ${parsed.status}`}${/CONNECTION_TIMED_OUT|ERR_/.test(parsed.error ?? '') ? ' (¿el sitio bloquea las IPs de AWS? headless no cura eso)' : ''}`)
    return null
  }
  return { texto: htmlToText(parsed.html), formato: 'html' }
}

/**
 * Descarga y extrae texto: PDF o HTML. Devuelve null y DICE POR QUÉ si no puede (nunca en silencio).
 * `opts.headless`: renderiza con la Lambda (para SPAs); `opts.waitFor`: selector CSS a esperar.
 */
export async function extraerTexto(
  url: string,
  opts: { headless?: boolean; waitFor?: string } = {},
): Promise<{ texto: string; formato: 'pdf' | 'html' } | null> {
  if (opts.headless) return fetchViaHeadless(url, opts.waitFor)

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

  const headless = process.argv.includes('--headless')
  const r = await extraerTexto(url, { headless, waitFor: arg('wait-for') })
  if (!r) process.exit(1)
  if (r.texto.trim().length < 200) { console.error(`✗ solo ${r.texto.length} chars: ¿PDF escaneado o página vacía?`); process.exit(1) }
  const pared = esParedDelPortal(r.texto)
  if (pared) {
    console.error(`✗ esto NO es el documento, es ${pared}. El portal devolvió 200 con una pared.`)
    console.error(`  Clonarlo metería basura con pinta de prueba en el corpus. Espera y reintenta, o busca otra vía.`)
    process.exit(1)
  }

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
