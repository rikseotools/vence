#!/usr/bin/env node
// scripts/audit-psico-explicacion.cjs — psicotécnicas cuya explicación no llega a su respuesta.
//
// SOLO LEE. Bajo demanda a propósito (no pinga el badge): el criterio dice si la explicación
// CIERRA, no si el razonamiento es correcto, y eso último —que es el defecto que destapó la
// familia— exige leerla. Ver `lib/health/psicotecnicoExplicacionSinRespuesta.cjs` y [T-500].
//
// Uso:
//   npm run audit:psico-explicacion              # resumen + ejemplos
//   npm run audit:psico-explicacion -- --todos   # lista completa
//   npm run audit:psico-explicacion -- --json    # para encadenar
'use strict'
require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const { analizarExplicacion } = require('../lib/health/psicotecnicoExplicacionSinRespuesta.cjs')

const ARGS = process.argv.slice(2)
const TODOS = ARGS.includes('--todos')
const JSON_OUT = ARGS.includes('--json')

;(async () => {
  const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })
  const filas = await sql`
    SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation
    FROM psychometric_questions
    WHERE is_active AND explanation IS NOT NULL AND length(explanation) > 20`

  const hallazgos = []
  let medibles = 0
  const exentas = {}
  for (const q of filas) {
    const opciones = [q.option_a, q.option_b, q.option_c, q.option_d]
    const r = analizarExplicacion({
      correcta: opciones[q.correct_option],
      opciones,
      explicacion: q.explanation,
      pregunta: q.question_text,
    })
    if (r.exenta) { exentas[r.exenta] = (exentas[r.exenta] || 0) + 1; continue }
    medibles++
    if (!r.cierra) {
      hallazgos.push({
        id: q.id,
        severidad: r.severidad,
        motivo: r.motivo,
        clave: String(opciones[q.correct_option] || '').replace(/\s+/g, ' ').slice(0, 40),
        pregunta: String(q.question_text || '').replace(/\s+/g, ' ').slice(0, 90),
      })
    }
  }
  await sql.end()

  const graves = hallazgos.filter((h) => h.severidad === 'error')
  const avisos = hallazgos.filter((h) => h.severidad === 'warn')

  if (JSON_OUT) {
    console.log(JSON.stringify({ activas: filas.length, medibles, exentas, graves: graves.length, avisos: avisos.length, hallazgos }, null, 1))
    process.exit(hallazgos.length ? 2 : 0)
  }

  console.log(`\n━━━ Psicotécnicas: ¿la explicación llega a su propia respuesta? ━━━`)
  console.log(`  activas con explicación: ${filas.length}`)
  console.log(`  medibles (clave numérica y sin exención): ${medibles}`)
  console.log(`  exentas: ${Object.entries(exentas).map(([k, v]) => `${k}=${v}`).join(' · ') || '—'}`)
  console.log(`\n  🔴 ${graves.length} no resuelven (nota interna pegada, se cortan, o cierran con la cifra de otra opción)`)
  console.log(`  🟡 ${avisos.length} nunca mencionan la cifra de su respuesta\n`)

  const muestra = (lista, n) => (TODOS ? lista : lista.slice(0, n))
  for (const h of muestra(graves, 8)) console.log(`  🔴 ${h.id} · clave ${h.clave}\n       ${h.motivo}\n       ${h.pregunta}`)
  if (!TODOS && graves.length > 8) console.log(`  … y ${graves.length - 8} más (--todos)`)
  console.log('')
  for (const h of muestra(avisos, 5)) console.log(`  🟡 ${h.id} · clave ${h.clave}\n       ${h.pregunta}`)
  if (!TODOS && avisos.length > 5) console.log(`  … y ${avisos.length - 5} más (--todos)`)

  console.log(`\n  Reparar de una en una contra el enunciado. NUNCA tocar la clave para que encaje con la explicación.`)
  process.exit(hallazgos.length ? 2 : 0)
})()
