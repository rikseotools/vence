#!/usr/bin/env node
'use strict'
// sim-materias-ganadas.cjs — SIMULACIÓN on-demand (solo lectura): tras reescribir epígrafes al
// literal, ¿qué MATERIAS NUEVAS aparecieron y las estamos sirviendo?
//
// Reescribir un epígrafe condensado a su literal casi siempre AÑADE materia (los "concepto",
// "generalidades", bloques enteros que la condensación se comía). El Paso 2 previo se verificó
// contra el texto VIEJO, así que su "correct" no dice nada de lo nuevo. Caso que lo motiva:
// Cantabria, donde el literal reveló que el programa pedía navegadores y servíamos CERO
// preguntas de esa materia (27/07/2026).
//
// Compara el epígrafe ANTERIOR (del dump previo, /tmp/verify_epigrafe_<pt>.json) con el actual
// en BD, saca los segmentos añadidos y mide si el tema sirve preguntas de esos términos.
//
// Uso:  node scripts/temario/sim-materias-ganadas.cjs <position_type> [--json <salida>]
//
// Con --json escribe {tema: {gano, huecos:[...]}} para decidir el Paso 2 con datos: un tema que
// ganó materia Y la sirve puede recuperar su veredicto; uno con un hueco NO (sería declarar una
// cobertura que nadie ha medido).
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const fs = require('fs')

const STOP = new Set(['sobre','entre','desde','entre','durante','entre','concepto','conceptos','generales','general','principales','tipos','tipo','otros','otras','mismo','misma','cada','como','para','their','sus','del','las','los','una','uno','que','con','por','sin','sus'])
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

function segmentosAnadidos(viejo, nuevo) {
  const v = norm(viejo)
  return String(nuevo || '').split(/(?<=[.;:])\s+/)
    .map((s) => s.trim()).filter(Boolean)
    .filter((s) => s.length > 12 && !v.includes(norm(s).replace(/[.;:]$/, '')))
}
function terminos(seg) {
  return [...new Set(norm(seg).replace(/[^\wáéíóúñ\s]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 6 && !STOP.has(w)))].slice(0, 3)
}

;(async () => {
  const pt = process.argv[2]
  if (!pt) { console.error('Uso: sim-materias-ganadas.cjs <position_type>'); process.exit(2) }
  const prev = JSON.parse(fs.readFileSync(`/tmp/verify_epigrafe_${pt}.json`, 'utf8'))
  const anterior = {}; for (const t of prev.temas) anterior[t.tema] = t.epigrafe_bd

  const c = new Client({ connectionString: process.env.DATABASE_URL.split('?')[0], ssl: { rejectUnauthorized: false } })
  await c.connect()
  const temas = (await c.query(
    `SELECT topic_number n, epigrafe FROM topics WHERE position_type=$1 AND is_active ORDER BY 1`, [pt])).rows
  const salida = {}
  let huecos = 0, revisados = 0
  for (const t of temas) {
    const segs = segmentosAnadidos(anterior[t.n], t.epigrafe)
    if (!segs.length) continue
    revisados++
    salida[t.n] = { gano: segs.length, huecos: [] }
    for (const s of segs) {
      const terms = terminos(s)
      if (!terms.length) continue
      const re = terms.join('|')
      const r = await c.query(
        `SELECT count(DISTINCT q.id) n FROM topics t
         JOIN topic_scope ts ON ts.topic_id=t.id
         JOIN articles a ON a.law_id=ts.law_id AND (ts.article_numbers IS NULL OR a.article_number=ANY(ts.article_numbers))
         JOIN questions q ON q.primary_article_id=a.id AND q.is_active
         WHERE t.position_type=$1 AND t.topic_number=$2 AND (q.question_text ~* $3 OR q.explanation ~* $3)`,
        [pt, t.n, re])
      const n = Number(r.rows[0].n)
      if (n === 0) { huecos++; salida[t.n].huecos.push({ segmento: s, terminos: terms }); console.log(`  🔴 T${t.n} · 0 preguntas · "${s.slice(0, 90)}" [${terms.join(', ')}]`) }
    }
  }
  console.log(`\n${pt}: ${revisados} temas ganaron materia · ${huecos} segmento(s) SIN cobertura`)
  const iJson = process.argv.indexOf('--json')
  if (iJson > 0 && process.argv[iJson + 1]) { fs.writeFileSync(process.argv[iJson + 1], JSON.stringify(salida, null, 1)); console.log(`→ ${process.argv[iJson + 1]}`) }
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
