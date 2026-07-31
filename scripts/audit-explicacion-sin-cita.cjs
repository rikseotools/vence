#!/usr/bin/env node
'use strict'
/**
 * audit-explicacion-sin-cita.cjs — «explicación estructurada SIN cita» = rastro de que el artículo
 * no responde a la pregunta.
 *
 * BAJO DEMANDA (`npm run audit:sin-cita`). Ver T-342. No consulta fuentes externas ni LLM: cruza
 * `explanation_data` con el artículo vinculado usando el criterio ÚNICO de literalidad del proyecto.
 *
 *   node scripts/audit-explicacion-sin-cita.cjs              # resumen + cola por exposición
 *   node scripts/audit-explicacion-sin-cita.cjs --limite 40
 *   node scripts/audit-explicacion-sin-cita.cjs --json
 */
const path = require('path')
const ROOT = path.resolve(__dirname, '..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') })
const postgres = require(path.join(ROOT, 'node_modules/postgres'))
const { clasificar, esHallazgo } = require(path.join(ROOT, 'lib/health/explicacionSinCita.js'))
const { citaNoLiteral } = require(path.join(ROOT, 'scripts/impugnaciones/validar-explicacion.cjs'))

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : d }
const LIMITE = parseInt(arg('--limite', '25'), 10)
const JSON_OUT = process.argv.includes('--json')
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 3, idle_timeout: 20 })

;(async () => {
  const rows = await sql`
    SELECT q.id, q.question_text, q.correct_option, q.option_a, q.option_b, q.option_c, q.option_d,
           q.explanation_data ed, a.content ac, l.short_name ley, l.is_virtual, a.article_number num,
           (SELECT count(*)::int FROM test_questions t WHERE t.question_id = q.id) exp
      FROM questions q
      LEFT JOIN articles a ON a.id = q.primary_article_id
      LEFT JOIN laws l ON l.id = a.law_id
     WHERE q.is_active AND q.explanation_data IS NOT NULL`

  const cuenta = {}
  const hallazgos = []
  for (const r of rows) {
    const clave = r[['option_a', 'option_b', 'option_c', 'option_d'][r.correct_option]] || ''
    const { estado } = clasificar({
      explanationData: r.ed, enunciado: r.question_text, textoClave: clave, contenidoArticulo: r.ac || '',
    }, citaNoLiteral)
    cuenta[estado] = (cuenta[estado] || 0) + 1
    if (esHallazgo(estado)) hallazgos.push({ id: r.id, estado, exp: r.exp, ley: r.ley, virtual: r.is_virtual === true, num: r.num, q: r.question_text })
  }
  hallazgos.sort((a, b) => b.exp - a.exp)

  if (JSON_OUT) { console.log(JSON.stringify({ cuenta, hallazgos }, null, 2)); await sql.end(); return }

  console.log(`\n🔎 Explicaciones estructuradas: ${rows.length} preguntas activas\n`)
  const orden = ['con_cita_literal', 'sin_cita', 'cita_no_literal', 'exento_negacion', 'exento_meta', 'sin_estructura']
  for (const e of orden) if (cuenta[e]) console.log(`   ${e.padEnd(18)} ${String(cuenta[e]).padStart(5)}  ${((cuenta[e] / rows.length) * 100).toFixed(1)}%`)

  const exp = hallazgos.reduce((s, h) => s + h.exp, 0)
  console.log(`\n   → ${hallazgos.length} hallazgos SIN CITA · ${exp} exposiciones`)
  console.log(`   (las ${cuenta.cita_no_literal || 0} «no literales» NO se reportan aquí: son terreno del barrido de citas,`)
  console.log(`    que solo marca las AJENAS —solape < 0,5— porque las retocadas no son defecto)`)
  const porLey = new Map()
  for (const h of hallazgos) {
    const k = `${h.ley || '(sin ley)'}${h.virtual ? ' [virtual]' : ''}`
    if (!porLey.has(k)) porLey.set(k, { n: 0, exp: 0 })
    const o = porLey.get(k); o.n++; o.exp += h.exp
  }
  console.log('\n   por contenedor (top 12 por exposición):')
  for (const [k, o] of [...porLey.entries()].sort((a, b) => b[1].exp - a[1].exp).slice(0, 12))
    console.log(`     ${String(o.n).padStart(4)}q · ${String(o.exp).padStart(6)} exp · ${k}`)

  console.log(`\n   cola por exposición (${Math.min(LIMITE, hallazgos.length)} de ${hallazgos.length}):`)
  for (const h of hallazgos.slice(0, LIMITE))
    console.log(`     ${h.id.slice(0, 8)} ${String(h.exp).padStart(4)}exp [${h.estado}] ${h.ley || '?'} art.${h.num} · ${h.q.replace(/\s+/g, ' ').slice(0, 78)}`)
  await sql.end()
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
