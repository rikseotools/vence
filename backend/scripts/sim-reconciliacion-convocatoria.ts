/**
 * sim-reconciliacion-convocatoria.ts — Fase 2 validada contra DATOS REALES antes de portarla al cron.
 *
 * Mismo camino que siguió `notas-extract.ts` (ver su cabecera): la lógica se prueba en runtime con un
 * script contra la fuente oficial de verdad, y SOLO después se mete en el servicio de Fargate.
 *
 * Importa las funciones REALES de backend/src/detect-notas-convocatoria/ — nunca una copia: una copia
 * da falso verde cuando el código real cambia.
 *
 * Uso:  NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/sim-reconciliacion-convocatoria.ts <slug>
 *
 * NO escribe nada: solo lee el documento oficial, extrae y compara. La escritura (findings) es del cron.
 */
// ⚠️ Ejecutar DESDE backend/ (ahí vive pdf-parse):
//    cd backend && NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx ../scripts/sim-reconciliacion-convocatoria.ts <slug>
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
for (const p of ['.env.local', '../.env.local']) {
  if (fs.existsSync(path.resolve(p))) { dotenv.config({ path: path.resolve(p) }); break }
}
import { Client } from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import {
  buildProcesoPrompt, reconciliar, hitosValidos,
  type ProcesoExtraction,
} from '../src/detect-notas-convocatoria/proceso-extract'
import { extractDocLinks, parseNotasJson } from '../src/detect-notas-convocatoria/notas-extract'

const SLUG = process.argv[2] ?? 'administrativo-madrid'
const HAIKU = 'claude-haiku-4-5-20251001'
const MAX_PDF = 8 * 1024 * 1024

async function fetchPdfText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'VenceBot/1.0' } })
    if (!res.ok) return ''
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_PDF || buf.subarray(0, 5).toString('latin1') !== '%PDF-') return ''
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default as (b: Buffer) => Promise<{ text: string }>
    return (await pdfParse(buf)).text ?? ''
  } catch (e) {
    // NO tragarse el error: un catch mudo convierte "falta pdf-parse" en "el documento no es
    // legible" y el sistema miente en silencio. (Pasó al escribir esto: 3 PDFs del BOCM daban
    // "no legible" cuando en realidad faltaba la dependencia.)
    console.log(`     ⚠️  ${(e as Error).message}`)
    return ''
  }
}

;(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()

  // 1. Lo que MOSTRAMOS (la vista: lo que ve el usuario, no la tabla cruda)
  const db = (await c.query(
    `SELECT o.slug, o.seguimiento_url, s.exam_date::text, s.plazas_libres, s.plazas_promocion_interna
       FROM oposiciones o JOIN oposiciones_ssot s ON s.slug = o.slug WHERE o.slug = $1`, [SLUG])).rows[0]
  if (!db) { console.error(`no existe ${SLUG}`); process.exit(1) }
  console.log(`\n═══ ${SLUG}`)
  console.log('MOSTRAMOS →', { exam_date: db.exam_date, plazas_libres: db.plazas_libres })
  console.log('seguimiento:', db.seguimiento_url)

  // 2. Documentos oficiales. Fuentes, por orden:
  //    a) --url explícita
  //    b) las que YA conocemos: convocatoria_verification.source_url + convocatoria_hitos.url
  //       (hallazgo 16/07: el `seguimiento_url` suele ser el PORTAL GENÉRICO de empleo, no la página
  //        de la convocatoria → crawlearlo NO llega a las bases. Las URLs buenas ya están en BD.)
  //    c) crawl del seguimiento_url (último recurso)
  const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice(6)
  let docs: string[] = []
  if (urlArg) {
    docs = [urlArg]
    console.log('\ndocumento explícito (--url)')
  } else {
    const conocidas = (await c.query(
      `SELECT DISTINCT u FROM (
         SELECT v.source_url AS u FROM convocatoria_verification v
           JOIN convocatorias cv ON cv.id = v.convocatoria_id
           JOIN oposiciones o2 ON o2.id = cv.oposicion_id WHERE o2.slug = $1 AND v.source_url IS NOT NULL
         UNION
         SELECT h.url FROM convocatoria_hitos h JOIN oposiciones o3 ON o3.id = h.oposicion_id
          WHERE o3.slug = $1 AND h.url IS NOT NULL
       ) t WHERE u ~* '\\.pdf(\\?|$)'`, [SLUG])).rows.map((r: any) => r.u)
    if (conocidas.length) console.log(`\ndocumentos ya conocidos en BD: ${conocidas.length}`)
    const html = await (await fetch(db.seguimiento_url, { headers: { 'User-Agent': 'VenceBot/1.0' } })).text()
    const crawl = extractDocLinks(html, db.seguimiento_url)
    console.log(`documentos crawleados del seguimiento: ${crawl.length}`)
    docs = [...new Set([...conocidas, ...crawl])]
  }

  const leidos: Array<{ titulo: string; texto: string; url: string }> = []
  for (const url of docs.slice(0, 6)) {
    const texto = await fetchPdfText(url)
    if (texto.trim().length < 200) { console.log('  ✗ (no PDF/vacío)', url.slice(-60)); continue }
    const titulo = decodeURIComponent(url.split('/').pop() ?? url).slice(0, 70)
    leidos.push({ titulo, texto, url })
    console.log(`  ✓ ${titulo} — ${texto.length} chars`)
  }
  if (!leidos.length) { console.log('\n⚠️ 0 documentos legibles → la reconciliación NO puede opinar (correcto: no inventa)'); await c.end(); return }

  // 3. Extracción con el prompt REAL.
  //    La clave sale de `ai_api_config` (base64), igual que AnthropicService en producción — NO de
  //    .env.local, que puede estar caducada (lo estaba: 401 al escribir esto).
  const keyRow = (await c.query(
    `SELECT api_key_encrypted FROM ai_api_config WHERE provider='anthropic' AND is_active=true LIMIT 1`)).rows[0]
  if (!keyRow) { console.error('sin clave en ai_api_config'); process.exit(1) }
  const anthropic = new Anthropic({ apiKey: Buffer.from(keyRow.api_key_encrypted, 'base64').toString('utf-8') })
  const resp = await anthropic.messages.create({
    model: HAIKU, max_tokens: 2048,
    messages: [{ role: 'user', content: buildProcesoPrompt(SLUG, leidos) }],
  })
  const block = resp.content[0]
  const parsed = parseNotasJson(block && block.type === 'text' ? block.text : '') as unknown as ProcesoExtraction | null
  if (!parsed) { console.error('❌ el LLM no devolvió JSON parseable'); await c.end(); process.exit(1) }

  console.log('\n─── EXTRAÍDO del documento oficial:')
  console.log('  fecha_examen:', parsed.fecha_examen, '| plazas_libres:', parsed.plazas_libres, '| confianza:', parsed.confianza)
  const validos = hitosValidos(parsed.hitos ?? [])
  console.log(`  hitos con cita y tipo válido: ${validos.length}/${(parsed.hitos ?? []).length}`)
  for (const h of validos) console.log(`    · ${h.tipo} ${h.fecha} — "${h.cita_literal.slice(0, 90)}"`)

  // 4. Reconciliación REAL
  const descuadres = reconciliar({ ...parsed, hitos: validos }, {
    exam_date: db.exam_date, plazas_libres: db.plazas_libres, plazas_promocion_interna: db.plazas_promocion_interna,
  })
  console.log('\─── RECONCILIACIÓN:')
  if (!descuadres.length) console.log('  ✅ sin descuadres (o confianza insuficiente para acusar)')
  for (const d of descuadres) {
    console.log(`  ${d.severidad === 'error' ? '🔴' : '🟡'} ${d.campo}: mostramos "${d.db}" · oficial "${d.oficial}"`)
    console.log(`     cita: "${d.cita.slice(0, 110)}"`)
  }
  console.log('\n(NUNCA auto-flip: esto es un hallazgo para revisar, no un UPDATE)')
  await c.end()
})().catch(e => { console.error('ERR', e); process.exit(1) })
