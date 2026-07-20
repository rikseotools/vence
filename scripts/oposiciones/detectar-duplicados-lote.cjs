#!/usr/bin/env node
/**
 * Detector de DUPLICADOS SEMÁNTICOS entre preguntas del mismo artículo.
 *
 * Nace de una colisión real (20/07): dos sesiones de Claude generaron banco en paralelo
 * sobre la MISMA norma sin saberlo, y produjeron 6 preguntas que preguntaban el mismo dato
 * con otras palabras. El texto era distinto, así que el `WHERE question_text = ...` del
 * generador no las veía: **hay que comparar la RESPUESTA CORRECTA, no el enunciado**.
 *
 * Criterio: dos preguntas del mismo artículo son sospechosas si la similitud de Jaccard de
 * sus opciones correctas supera el umbral (por defecto 0,6). El enunciado se reporta solo
 * como contexto — puede diferir mucho y ser el mismo dato.
 *
 * NO borra nada: imprime los pares para que un humano decida cuál conservar. La regla que
 * se siguió el 20/07: ante dos equivalentes de sesiones distintas, retirar la PROPIA y
 * conservar la ajena, salvo que una cubra estrictamente más que la otra.
 *
 * Uso:
 *   node scripts/oposiciones/detectar-duplicados-lote.cjs --ley "Normativa Permanencia UAL"
 *   node scripts/oposiciones/detectar-duplicados-lote.cjs --like "%UAL%" [--umbral 0.6]
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')

const args = process.argv.slice(2)
const val = (f, d) => { const i = args.indexOf(f); return i > -1 ? args[i + 1] : d }
const LEY = val('--ley', null)
const LIKE = val('--like', '%')
const UMBRAL = Number(val('--umbral', '0.6'))

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function jaccard(a, b) {
  const A = new Set(norm(a).split(' ').filter((w) => w.length > 4))
  const B = new Set(norm(b).split(' ').filter((w) => w.length > 4))
  const inter = [...A].filter((x) => B.has(x)).length
  const uni = A.size + B.size - inter
  return uni ? inter / uni : 0
}

function newClient() {
  const url = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/, '')
  return new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
}

async function main() {
  const c = newClient()
  await c.connect()
  try {
    const r = (await c.query(
      `SELECT q.id, q.question_text qt, q.correct_option co, q.option_a, q.option_b, q.option_c, q.option_d,
              q.created_at, q.tags, a.article_number n, l.short_name ley
       FROM questions q JOIN articles a ON a.id = q.primary_article_id JOIN laws l ON l.id = a.law_id
       WHERE q.is_active AND ($1::text IS NULL OR l.short_name = $1) AND l.short_name LIKE $2
       ORDER BY l.short_name, a.article_number`, [LEY, LIKE])).rows

    console.log(`preguntas activas analizadas: ${r.length}`)
    const porArt = new Map()
    for (const q of r) {
      const k = `${q.ley}|art ${q.n}`
      if (!porArt.has(k)) porArt.set(k, [])
      porArt.get(k).push(q)
    }

    let pares = 0
    for (const [k, arr] of porArt) {
      if (arr.length < 2) continue
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const A = arr[i], B = arr[j]
          const corA = [A.option_a, A.option_b, A.option_c, A.option_d][A.co]
          const corB = [B.option_a, B.option_b, B.option_c, B.option_d][B.co]
          const sim = jaccard(corA, corB)
          if (sim < UMBRAL) continue
          pares++
          console.log(`\n⚠️  ${k} — respuestas correctas ${(sim * 100).toFixed(0)}% similares (enunciados ${(jaccard(A.qt, B.qt) * 100).toFixed(0)}%)`)
          console.log(`   [${A.created_at.toISOString().slice(0, 16)}] ${A.qt.slice(0, 92)}`)
          console.log(`        → ${corA.slice(0, 92)}`)
          console.log(`   [${B.created_at.toISOString().slice(0, 16)}] ${B.qt.slice(0, 92)}`)
          console.log(`        → ${corB.slice(0, 92)}`)
        }
      }
    }
    console.log(`\n=== ${pares} par(es) sospechoso(s) de duplicado (umbral ${UMBRAL}) ===`)
    if (pares) console.log('Revisar a mano y retirar con transition_question_state(..., \'retired_duplicate\', \'duplicate_exact\', ...).')
  } finally { await c.end() }
}
main().catch((e) => { console.error('❌', e.message); process.exitCode = 1 })
