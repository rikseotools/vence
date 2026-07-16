/**
 * sim-radar-por-fuente.ts — PROTOTIPO del radar invertido (bucle por FUENTE, no por oposición).
 *
 * Diseño: docs/roadmap/radar-por-fuente.md
 *
 * QUÉ PRUEBA: hoy `detect-oep-llm` recorre oposiciones y atribuye lo que extrae a aquella cuyo
 * seguimiento_url estaba leyendo → si la URL es un tablón general (48% del catálogo comparte fuente),
 * el LLM elige UN cuerpo, se lo endosa al que tocaba, y TIRA los demás. Este prototipo hace lo
 * contrario: lee la fuente UNA vez, saca TODAS las convocatorias, y casa cada una por su CONTENIDO.
 *
 * NO ESCRIBE NADA. Solo compara: ¿cuántas convocatorias hay de verdad en la página? ¿a quién casan?
 * ¿cuántas se estaban tirando?
 *
 * Mismo camino que notas-extract.ts y la Fase 2: validar contra la fuente REAL antes de tocar el cron.
 *
 * Uso (desde backend/):
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/sim-radar-por-fuente.ts [referencia-del-corpus]
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'
for (const p of ['.env.local', '../.env.local']) {
  if (fs.existsSync(path.resolve(p))) { dotenv.config({ path: path.resolve(p) }); break }
}
import { Client } from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import { classifyFamily } from '../src/oep-signals/oep-match'
import { parseNotasJson } from '../src/detect-notas-convocatoria/notas-extract'

const REF = process.argv[2] ?? 'BOPVA-19/11/2024'   // el tablón de Valladolid: sabemos que tiene ≥4 cuerpos

interface ConvExtraida {
  cuerpo: string
  plazas: number | null
  turno: string | null
  estado: string | null
  fechas: string | null
  cita_literal: string
}

/** El prompt INVERTIDO: no "extrae LA convocatoria de este cuerpo" sino "lista TODAS las que haya". */
function buildPromptFuente(texto: string): string {
  return `Eres analista de oposiciones españolas. Lee esta página oficial de empleo público y lista TODAS
las convocatorias de proceso selectivo que aparezcan, SIN filtrar por cuerpo.

REGLAS:
1. UNA entrada por convocatoria. Si la página lista Administrativo, Inspector y Subinspector, devuelve TRES.
2. "cuerpo": el nombre del cuerpo/puesto TAL CUAL aparece.
3. "cita_literal": la frase EXACTA de la página que la anuncia. Sin cita, no la incluyas.
4. NO inventes. Si un dato no aparece, null. Las cifras deben estar escritas en el texto.
5. Ignora lo que no sea un proceso selectivo (becas, contratos menores, licitaciones).

Devuelve EXCLUSIVAMENTE JSON:
{"convocatorias":[{"cuerpo":"...","plazas":<n|null>,"turno":"libre|promocion_interna|null","estado":"<fase|null>","fechas":"<texto|null>","cita_literal":"<exacta>"}]}

${texto.slice(0, 90_000)}`
}

;(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await c.connect()

  const doc = (await c.query(
    `SELECT titulo, url, extracted_text FROM convocatoria_documentos WHERE referencia = $1`, [REF])).rows[0]
  if (!doc) { console.error(`${REF} no está en el corpus. Clónalo antes con clonar-documento.ts`); process.exit(1) }
  console.log(`\n═══ FUENTE: ${doc.titulo}`)
  console.log(`    ${doc.url}`)
  console.log(`    ${(doc.extracted_text.length / 1024).toFixed(0)} KB — leído del CORPUS, sin red\n`)

  // ── Cuántas oposiciones COMPARTEN esta fuente (hoy = una pasada del sensor por cada una)
  const comparten = (await c.query(
    `SELECT slug FROM oposiciones WHERE seguimiento_url = $1 ORDER BY slug`, [doc.url])).rows
  console.log(`HOY: ${comparten.length} oposición(es) comparten esta URL → ${comparten.length} pasadas del sensor,`)
  console.log(`     cada una extrayendo UN cuerpo y tirando el resto:`)
  for (const o of comparten) console.log(`       · ${o.slug}`)

  // ── El bucle invertido: UNA pasada, TODAS las convocatorias
  const key = (await c.query(`SELECT api_key_encrypted FROM ai_api_config WHERE provider='anthropic' AND is_active=true LIMIT 1`)).rows[0]
  const anthropic = new Anthropic({ apiKey: Buffer.from(key.api_key_encrypted, 'base64').toString('utf-8') })
  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 3000,
    messages: [{ role: 'user', content: buildPromptFuente(doc.extracted_text) }],
  })
  const b = resp.content[0]
  const parsed = parseNotasJson(b && b.type === 'text' ? b.text : '') as { convocatorias?: ConvExtraida[] } | null
  const convs = (parsed?.convocatorias ?? []).filter((x) => x?.cuerpo && x?.cita_literal?.trim())

  console.log(`\n─── REFORMA: 1 pasada → ${convs.length} convocatoria(s) extraídas de la MISMA página\n`)

  // ── Casar cada una por su CONTENIDO contra el catálogo
  const catalogo = (await c.query(`SELECT slug FROM oposiciones WHERE slug IS NOT NULL`)).rows.map((r) => r.slug as string)
  let casadas = 0, descubrimientos = 0
  for (const cv of convs) {
    const fam = classifyFamily(cv.cuerpo)
    // Candidatas: misma familia + comparten alguna palabra de entidad con el slug de la fuente
    const pistaEntidad = comparten[0]?.slug?.split('-').slice(-1)[0] ?? ''
    const cands = catalogo.filter((s) => classifyFamily(s.replace(/-/g, ' ')) === fam && fam !== null && s.includes(pistaEntidad))
    const veredicto = cands.length === 1 ? `→ casa con ${cands[0]}`
      : cands.length > 1 ? `→ ${cands.length} candidatas (${cands.slice(0, 3).join(', ')}) → criterio`
      : `→ DESCUBRIMIENTO (familia ${fam ?? 'no modelada'}) → catalogar`
    if (cands.length === 1) casadas++; else descubrimientos++
    console.log(`  · ${cv.cuerpo}`)
    console.log(`      plazas=${cv.plazas ?? '—'} turno=${cv.turno ?? '—'} estado=${cv.estado ?? '—'}`)
    console.log(`      "${cv.cita_literal.slice(0, 90)}"`)
    console.log(`      ${veredicto}\n`)
  }

  console.log('═══ COMPARACIÓN')
  console.log(`  HOY:     ${comparten.length} pasadas · extrae ${comparten.length} convocatoria(s) (1 por oposición) · TIRA el resto`)
  console.log(`  REFORMA: 1 pasada · extrae ${convs.length} · ${casadas} casan · ${descubrimientos} descubrimiento(s) → se catalogan, NO se tiran`)
  console.log(`\n  Dato que se estaba PERDIENDO cada día: ${Math.max(0, convs.length - comparten.length)} convocatoria(s)`)
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
