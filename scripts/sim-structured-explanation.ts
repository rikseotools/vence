/**
 * SIMULACIÓN (Fase 2 shuffle) sobre datos REALES de RDS.
 *
 * Prueba dos cosas sobre el banco vivo:
 *   1) TASA DE MIGRACIÓN determinista: qué % del §8.1 letra-anclado se convierte a
 *      `explanation_data` con `parseLetterFormatExplanation` (sin LLM). El resto queda
 *      para la pasada LLM (parseo asistido) — es inocuo (no se migra, no se rompe).
 *   2) INVARIANTE de barajado end-to-end: para cada pregunta migrada y VARIAS
 *      permutaciones reales (permutationFor), se comprueba que
 *          parse( render( estructura, order ), dispCorrect )  ==  estructura (remapeada)
 *      es decir: al barajar, la razón de cada opción viaja con ella y las letras del
 *      render son coherentes con la posición mostrada. Si render o parser tuvieran un
 *      bug, el round-trip no cerraría.
 *
 * Uso:
 *   DATABASE_URL=... NODE_TLS_REJECT_UNAUTHORIZED=0 npx tsx scripts/sim-structured-explanation.ts [N]
 */
import postgres from 'postgres'
import {
  parseLetterFormatExplanation,
  renderStructuredExplanation,
  StructuredExplanation,
} from '../lib/shuffle/structuredExplanation'
import { permutationFor } from '../lib/shuffle/permute'

const N = parseInt(process.argv[2] || '3000', 10)

function norm(s: string): string {
  return s.replace(/[*_`~]+/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } })

  // Universo: preguntas activas, full, con explicación letra-anclada §8.1 (las que HOY
  // no se barajan por citar letras). Es el conjunto que la Fase 2 desbloquea.
  const rows = await sql<
    { id: string; correct_option: number; option_a: string | null; option_b: string | null; option_c: string | null; option_d: string | null; explanation: string }[]
  >`
    SELECT id, correct_option, option_a, option_b, option_c, option_d, explanation
    FROM questions
    WHERE is_active AND shuffle_mode = 'full'
      AND explanation LIKE '%Por qué%'
      AND explanation LIKE '%son incorrectas%'
    ORDER BY id
    LIMIT ${N}
  `

  let parsed = 0
  let parseNull = 0
  let badParse = 0
  let invariantChecked = 0
  let invariantFail = 0
  const failSamples: string[] = []
  const nullSamples: string[] = []
  const badSamples: string[] = []

  for (const q of rows) {
    const opts = [q.option_a, q.option_b, q.option_c, q.option_d].filter((v) => v != null && v !== '') as string[]
    const nOptions = opts.length
    if (nOptions < 2 || q.correct_option == null || q.correct_option >= nOptions) continue

    const s1 = parseLetterFormatExplanation(q.explanation, { correctOption: q.correct_option, nOptions })
    if (!s1) {
      parseNull++
      if (nullSamples.length < 6) nullSamples.push(q.id)
      continue
    }
    // GUARDA ANTI-FALSO-PARSEO (la invariante ida-vuelta no la cubre):
    //  (a) toda razón debe ser subcadena del original (no inventada);
    //  (b) las razones deben ser pairwise-distintas (un mal parseo colapsa/duplica).
    const origNorm = norm(q.explanation)
    const reasons = Object.values(s1.options).map(norm)
    const allSubstr = reasons.every((r) => origNorm.includes(r.slice(0, Math.min(40, r.length))))
    const distinct = new Set(reasons).size === reasons.length
    if (!allSubstr || !distinct) {
      badParse++
      if (badSamples.length < 8) badSamples.push(`${q.id} (${!allSubstr ? 'no-substr' : 'dup-reason'})`)
      continue
    }
    parsed++

    // Probar 5 permutaciones reales (nonce distinto por exposición).
    for (let k = 0; k < 5; k++) {
      const order = permutationFor(q.id, `sim-${k}`, nOptions)
      const rendered = renderStructuredExplanation(s1, { correctOption: q.correct_option, optionOrder: order, nOptions })

      // correct_option en coords MOSTRADAS para re-parsear la salida renderizada
      const dispCorrect = order.indexOf(q.correct_option)
      const s2 = parseLetterFormatExplanation(rendered, { correctOption: dispCorrect, nOptions })
      invariantChecked++

      if (!s2) {
        invariantFail++
        if (failSamples.length < 8) failSamples.push(`${q.id} k=${k} (reparse null)`)
        continue
      }
      // Remap: razón en pos MOSTRADA p (s2) debe ser la razón de la opción ORIGINAL order[p] (s1)
      let ok = true
      for (let p = 0; p < nOptions; p++) {
        const original = order[p]
        const a = norm(s2.options[String(p)] || '')
        const b = norm(s1.options[String(original)] || '')
        // tolerancia: uno contenido en el otro (el parser puede recortar espacios/puntos)
        if (a !== b && !a.includes(b) && !b.includes(a)) {
          ok = false
          break
        }
      }
      if (!ok) {
        invariantFail++
        if (failSamples.length < 8) failSamples.push(`${q.id} k=${k} (mismatch)`)
      }
    }
  }

  const universo = rows.length
  console.log('════════ SIMULACIÓN Fase 2 (explicación estructurada + barajado) ════════')
  console.log(`Universo (full + §8.1 letra-anclado, muestra):  ${universo}`)
  console.log(`Migradas por parser determinista:               ${parsed}  (${((parsed / universo) * 100).toFixed(1)}%)`)
  console.log(`Rechazadas por guarda anti-falso-parseo:        ${badParse}  (${((badParse / universo) * 100).toFixed(1)}%)`)
  console.log(`No migrables por parser (→ pasada LLM):         ${parseNull}  (${((parseNull / universo) * 100).toFixed(1)}%)`)
  if (badSamples.length) console.log('  ejemplos rechazados:', badSamples.join(', '))
  console.log('──── INVARIANTE de barajado (parse∘render == identidad bajo permutación) ────')
  console.log(`Permutaciones comprobadas:                      ${invariantChecked}`)
  console.log(`FALLOS de invariante:                           ${invariantFail}`)
  console.log(`Tasa de coherencia:                             ${(((invariantChecked - invariantFail) / Math.max(1, invariantChecked)) * 100).toFixed(3)}%`)
  if (failSamples.length) console.log('  ejemplos fallo:', failSamples.join(', '))
  if (nullSamples.length) console.log('  ejemplos no-migrables:', nullSamples.join(', '))

  await sql.end()
  // La invariante DEBE ser 0 fallos: un fallo = barajar rompería la explicación.
  if (invariantFail > 0) {
    console.error('\n❌ INVARIANTE VIOLADA — el diseño NO es seguro para esos casos.')
    process.exit(1)
  }
  console.log('\n✅ Invariante 100% — barajar preserva la coherencia razón↔opción↔letra.')
}

main().catch((e) => {
  console.error('ERR', e)
  process.exit(1)
})
