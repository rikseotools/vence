#!/usr/bin/env node
'use strict'
/**
 * audit-explicacion-eco.cjs — «explicación que no explica»: repite la opción correcta (ECO), y
 * en la banda urgente trae la palabra/número/verbo FALSEADO pegado al verdadero (ECO CONTAMINADO).
 *
 * BAJO DEMANDA (T-557). Núcleo puro en `lib/health/explicacionEcoClave.cjs` — lee ahí el porqué
 * de cada criterio y su calibración. Este script solo consulta y presenta; no escribe nada.
 *
 *   node scripts/audit-explicacion-eco.cjs                 # resumen + muestra de contaminadas
 *   node scripts/audit-explicacion-eco.cjs --limite 40
 *   node scripts/audit-explicacion-eco.cjs --json
 *
 * Credencial: VENCE_LECTOR_URL (SELECT de solo lectura; ver lib/db/pgSsl.cjs).
 */
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') })
const { Client } = require(path.join(ROOT, 'node_modules/pg'))
const { pgConfig } = require(path.join(ROOT, 'lib/db/pgSsl.cjs'))
const { clasificaPregunta } = require(path.join(ROOT, 'lib/health/explicacionEcoClave.cjs'))

const arg = (n, d) => {
  const i = process.argv.indexOf(n)
  return i > -1 ? process.argv[i + 1] : d
}
const LIMITE = parseInt(arg('--limite', '25'), 10)
const JSON_OUT = process.argv.includes('--json')

;(async () => {
  const url = process.env.VENCE_LECTOR_URL || process.env.DATABASE_URL
  if (!url) {
    console.error('⚠️  Falta VENCE_LECTOR_URL (o DATABASE_URL con acceso de negocio).')
    process.exit(1)
  }
  const client = new Client(pgConfig(url))
  await client.connect()

  const { rows } = await client.query(`
    SELECT id, question_text, correct_option, option_a, option_b, option_c, option_d,
           explanation, is_official_exam, exam_position
      FROM questions
     WHERE is_active = true
       AND explanation_data IS NULL
       AND length(explanation) BETWEEN 40 AND 400
  `)
  await client.end()

  let eco = 0
  let contaminado = 0
  const hallazgosContaminados = []
  for (const r of rows) {
    const c = clasificaPregunta(r)
    if (!c.eco) continue
    eco++
    if (c.contaminado) {
      contaminado++
      hallazgosContaminados.push({
        id: r.id,
        oficial: !!r.is_official_exam,
        examPosition: r.exam_position || null,
        numeros: c.numeros,
        verbos: c.verbos,
        explanation: r.explanation,
      })
    }
  }

  // Sin exposición real: `test_questions` está bloqueada para este rol (T-573, sin aplicar
  // todavía — ver la propia ficha T-557/T-530 de esta sesión). Se prioriza por lo único medible
  // hoy: si es de examen OFICIAL (más visible, más citable en una impugnación).
  hallazgosContaminados.sort((a, b) => Number(b.oficial) - Number(a.oficial))

  if (JSON_OUT) {
    console.log(JSON.stringify({ base: rows.length, eco, contaminado, hallazgos: hallazgosContaminados.slice(0, LIMITE) }, null, 2))
    return
  }

  console.log(`\n== Explicaciones eco de su propia opción (T-557) ==`)
  console.log(`   base evaluada (activas, sin explanation_data, 40-400 car.): ${rows.length}`)
  console.log(`   ECO (repite la opción, no explica): ${eco}`)
  console.log(`   ECO CONTAMINADO (dos candidatos pegados — la banda urgente): ${contaminado}`)
  console.log(`\n   ⚠️  Sin exposición real (test_questions bloqueada para este rol, T-573 sin aplicar):`)
  console.log(`      la cola de abajo NO está ordenada por cuánta gente la ve — solo por si es de examen oficial.`)
  console.log(`\n== Cola de contaminadas (${Math.min(LIMITE, hallazgosContaminados.length)} de ${hallazgosContaminados.length}) ==`)
  for (const h of hallazgosContaminados.slice(0, LIMITE)) {
    console.log(`\n   ${h.oficial ? '🏛️ OFICIAL' : '  '} ${h.id}${h.examPosition ? ` (${h.examPosition})` : ''}`)
    if (h.numeros.length) console.log(`      números pegados: ${h.numeros.join(' | ')}`)
    if (h.verbos.length) console.log(`      verbos pegados: ${h.verbos.join(' | ')}`)
    console.log(`      "${h.explanation.slice(0, 160)}${h.explanation.length > 160 ? '…' : ''}"`)
  }
  console.log('')
})().catch((e) => {
  console.error('❌ Error:', e.message)
  process.exit(1)
})
