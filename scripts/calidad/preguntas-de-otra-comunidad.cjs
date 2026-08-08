#!/usr/bin/env node
/**
 * scripts/calidad/preguntas-de-otra-comunidad.cjs — ¿qué preguntas de OTRA comunidad autónoma
 * recibe una oposición? (T-732, 08/08/2026)
 *
 * ## POR QUÉ
 *
 * Alba España (premium, TCAE de Madrid) lo dijo así: *«ESTOY ESTUDIANDO COMUNIDAD DE MADRID NO DE
 * VALENCIA»*. Las preguntas de normativa autonómica cuelgan de artículos de leyes genéricas que
 * decenas de oposiciones escopan enteras, y **no hay ningún filtro por comunidad** entre la
 * pregunta y el temario. Duele porque en estas materias **la respuesta correcta cambia según la
 * comunidad**: no es temario de más, es una clave falsa para su examen.
 *
 * ## SOLO LEE. Y no propone desactivar nada
 *
 * Cada una de estas preguntas es **legítima para su comunidad** (la de Abucasis es correcta para
 * Valencia), así que la salida es moverlas a un artículo propio de esa comunidad, no borrarlas.
 * Esta herramienta ordena la cola; la decisión de cada pregunta la toma una persona leyéndola.
 *
 * ## BAJO DEMANDA a propósito, no al badge
 *
 * El criterio separa `examina_otra` (defecto) de `menciona` (cita incidental, casi siempre
 * correcta), pero la frontera exige leer: mandar esto a un badge nocturno lo llenaría de casos que
 * nadie puede triar en bloque. Mismo criterio que `audit:vinculo-vecino` y `audit:corpus-ajeno`.
 *
 * Uso:
 *   node scripts/calidad/preguntas-de-otra-comunidad.cjs --oposicion tcae_sermas_madrid
 *   node scripts/calidad/preguntas-de-otra-comunidad.cjs --oposicion X --comunidad "Comunidad de Madrid"
 *   node scripts/calidad/preguntas-de-otra-comunidad.cjs --oposicion X --todas   (incluye «menciona»)
 */
require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { clasificar, comunidadesEn } = require('../../lib/health/preguntaDeOtraComunidad.cjs')

const argv = process.argv.slice(2)
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null }
const OPOSICION = arg('--oposicion')
const COMUNIDAD_MANUAL = arg('--comunidad')
const TODAS = argv.includes('--todas')

async function main() {
  if (!OPOSICION) throw new Error('falta --oposicion <position_type> (p. ej. tcae_sermas_madrid)')
  const c = new Client(pgConfig())
  await c.connect()

  // La comunidad de referencia se deduce de `oposiciones.administracion` con el MISMO núcleo que
  // clasifica las preguntas («Servicio Andaluz de Salud» → Andalucía). Un solo criterio, no dos.
  let comunidad = COMUNIDAD_MANUAL
  if (!comunidad) {
    const o = (await c.query(
      `SELECT nombre, administracion FROM oposiciones WHERE slug = replace($1,'_','-') OR slug = $1 LIMIT 1`,
      [OPOSICION])).rows[0]
    const detectadas = comunidadesEn(`${o?.administracion || ''} ${o?.nombre || ''}`)
    comunidad = detectadas[0]?.comunidad || null
    console.log(`\nOposición: ${OPOSICION}${o ? ` · ${o.administracion || o.nombre}` : ''}`)
  }
  if (!comunidad) {
    console.log('⚠️  No he podido deducir su comunidad — pásala con --comunidad "…".')
    console.log('    Sin ella todo lo autonómico saldría como ajeno, incluido lo suyo.\n')
    await c.end(); return
  }
  console.log(`Comunidad de referencia: ${comunidad}\n`)

  const filas = (await c.query(`
    SELECT DISTINCT q.id, t.topic_number, q.question_text, q.explanation,
           (ARRAY[q.option_a, q.option_b, q.option_c, q.option_d])[q.correct_option + 1] AS correcta,
           (SELECT COUNT(*)::int FROM test_questions tq WHERE tq.question_id = q.id) AS servida
      FROM topics t
      JOIN topic_scope ts ON ts.topic_id = t.id
      JOIN articles a ON a.law_id = ts.law_id AND a.is_active
        AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
      JOIN questions q ON q.primary_article_id = a.id AND q.is_active
     WHERE t.position_type = $1 AND t.is_active`, [OPOSICION])).rows

  const cubos = { examina_otra: [], ambigua: [], menciona: [], propia: [], limpia: [] }
  for (const f of filas) {
    const r = clasificar({
      questionText: f.question_text, correcta: f.correcta, explanation: f.explanation, comunidad,
    })
    cubos[r.veredicto].push({ ...f, ...r })
  }

  const pinta = (titulo, lista, nota) => {
    console.log(`── ${titulo}: ${lista.length} ${nota || ''}`)
    for (const x of lista.sort((a, b) => b.servida - a.servida)) {
      console.log(`   T${String(x.topic_number).padStart(2)} ${x.id.slice(0, 8)} · servida ${String(x.servida).padStart(3)} · ${x.comunidades.join(', ')}`)
      console.log(`      ${String(x.question_text).replace(/\s+/g, ' ').slice(0, 100)}`)
    }
    console.log('')
  }

  pinta('🔴 EXAMINA normativa de OTRA comunidad', cubos.examina_otra, '— defecto: leer y mover a un artículo de su comunidad')
  pinta('🟡 AMBIGUA (sigla que vale para dos comunidades)', cubos.ambigua, '— hay que leerla')
  if (TODAS) pinta('⚪ solo la MENCIONA (suele ser correcta)', cubos.menciona)

  console.log(`   Analizadas ${filas.length} preguntas activas de ${OPOSICION}.`)
  console.log(`   ${cubos.propia.length} son de su propia comunidad · ${cubos.limpia.length} no citan ninguna` +
    `${TODAS ? '' : ` · ${cubos.menciona.length} solo la mencionan (--todas para verlas)`}\n`)
  await c.end()
}

if (require.main === module) main().catch((e) => { console.error('❌', e.message); process.exit(1) })
