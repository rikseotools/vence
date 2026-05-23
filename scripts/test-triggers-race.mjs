// scripts/test-triggers-race.mjs
//
// Test de carrera concurrente para los 15 triggers nuevos sobre
// test_questions (más el 1 sobre tests). Simula el peor caso: un user
// "Corregir Examen" que dispara 100 INSERTs al mismo user al mismo
// tiempo (lo que pasa cuando se valida un examen batch en /api/exam/validate).
//
// Diseño:
//   1) Toma un user con datos existentes
//   2) Captura snapshot de counters en las 5 tablas materializadas
//   3) Lanza 100 INSERTs CONCURRENTES (cada uno en su propia TX) con
//      Promise.all + pool max=10 → fuerza race real, no secuencial
//   4) Verifica deltas exactos (+100 questions, +N corrects, etc)
//   5) DELETE las 100 filas → triggers DELETE revierten counters
//   6) Verifica que counters vuelven al estado original (idempotencia)
//
// Criterio de éxito:
//   - Counters tras INSERTs = snapshot + delta esperado (sin pérdida)
//   - Counters tras DELETE = snapshot original (sin residuo)
//
// Si ALGUN counter difiere, hay race condition que el cutover no debe
// hacer hasta arreglar.

import postgres from '/home/manuel/Documentos/github/vence/node_modules/postgres/src/index.js'
import dotenv from '/home/manuel/Documentos/github/vence/node_modules/dotenv/lib/main.js'

dotenv.config({ path: '/home/manuel/Documentos/github/vence/.env.local' })

// Pool con 10 conexiones → permite hasta 10 INSERTs paralelos reales
const sql = postgres(process.env.DATABASE_URL, {
  max: 10,
  prepare: false,
  onnotice: () => {},
})

const N = 100
const CORRECT_RATIO = 0.5
const TIME_PER_Q = 10

async function snapshot(userId) {
  const r = await sql`
    SELECT
      (SELECT total_questions FROM user_stats_summary WHERE user_id=${userId}) AS uss_q,
      (SELECT correct_answers FROM user_stats_summary WHERE user_id=${userId}) AS uss_c,
      (SELECT total_time_seconds FROM user_stats_summary WHERE user_id=${userId}) AS uss_t,
      (SELECT SUM(total_questions)::int FROM user_difficulty_stats WHERE user_id=${userId}) AS diff_q,
      (SELECT SUM(correct_answers)::int FROM user_difficulty_stats WHERE user_id=${userId}) AS diff_c,
      (SELECT SUM(total_time_seconds)::bigint FROM user_difficulty_stats WHERE user_id=${userId}) AS diff_t,
      (SELECT SUM(total_questions)::int FROM user_hourly_stats WHERE user_id=${userId}) AS hour_q,
      (SELECT SUM(correct_answers)::int FROM user_hourly_stats WHERE user_id=${userId}) AS hour_c,
      (SELECT SUM(total_questions)::int FROM user_article_stats WHERE user_id=${userId}) AS art_q,
      (SELECT SUM(correct_answers)::int FROM user_article_stats WHERE user_id=${userId}) AS art_c,
      (SELECT SUM(total_questions)::int FROM user_daily_stats WHERE user_id=${userId}) AS day_q,
      (SELECT SUM(correct_answers)::int FROM user_daily_stats WHERE user_id=${userId}) AS day_c,
      (SELECT SUM(total_time_seconds)::bigint FROM user_daily_stats WHERE user_id=${userId}) AS day_t
  `
  const x = r[0]
  return {
    uss_q: x.uss_q ?? 0,
    uss_c: x.uss_c ?? 0,
    uss_t: Number(x.uss_t ?? 0),
    diff_q: x.diff_q ?? 0, diff_c: x.diff_c ?? 0, diff_t: Number(x.diff_t ?? 0),
    hour_q: x.hour_q ?? 0, hour_c: x.hour_c ?? 0,
    art_q: x.art_q ?? 0, art_c: x.art_c ?? 0,
    day_q: x.day_q ?? 0, day_c: x.day_c ?? 0, day_t: Number(x.day_t ?? 0),
  }
}

function diff(after, before, expected) {
  const lines = []
  let allOk = true
  for (const k of Object.keys(expected)) {
    const actual = (after[k] ?? 0) - (before[k] ?? 0)
    const ok = actual === expected[k]
    lines.push(`  ${ok ? '✅' : '❌'} ${k}: esperado +${expected[k]}, real +${actual}`)
    if (!ok) allOk = false
  }
  return { ok: allOk, lines }
}

try {
  // Seed: un user con datos existentes — uno YA backfileado para evitar mezclar el race con backfill
  const seedRow = (await sql`
    SELECT tq.* FROM test_questions tq
    WHERE tq.user_id IS NOT NULL AND tq.question_id IS NOT NULL
      AND tq.article_number IS NOT NULL AND tq.difficulty = 'medium'
      AND tq.user_answer IS NOT NULL
      AND tq.tema_number IS NOT NULL AND tq.law_name IS NOT NULL
      AND EXISTS (SELECT 1 FROM backfill_materialized_stats_progress p WHERE p.user_id = tq.user_id)
    LIMIT 1
  `)[0]
  if (!seedRow) {
    console.error('No seed found — necesita user backfileado con datos completos')
    process.exit(1)
  }
  const userId = seedRow.user_id
  console.log(`Seed user: ${userId.slice(0,8)} (en backfill_progress)`)
  console.log(`Difficulty: ${seedRow.difficulty} | article=${seedRow.article_number} | law=${seedRow.law_name} | tema=${seedRow.tema_number}`)

  // Snapshot pre
  const before = await snapshot(userId)
  console.log('\nSnapshot pre-test:', before)

  // Lanzar N INSERTs concurrentes
  console.log(`\nLanzando ${N} INSERTs concurrentes (pool max=10)...`)
  const t0 = Date.now()
  const insertedIds = []
  const errors = []
  const promises = Array.from({ length: N }, (_, i) => {
    const isCorrect = i < N * CORRECT_RATIO  // primeros 50: true, resto: false
    return sql.begin(async (tx) => {
      // Clonar fila + INSERT
      await tx`CREATE TEMP TABLE _s ON COMMIT DROP AS SELECT * FROM test_questions WHERE id = ${seedRow.id}`
      await tx`UPDATE _s SET id = gen_random_uuid(), question_order = 700000 + ${i},
                              is_correct = ${isCorrect}, time_spent_seconds = ${TIME_PER_Q},
                              created_at = NOW(), updated_at = NOW()`
      const ins = await tx`INSERT INTO test_questions SELECT * FROM _s RETURNING id`
      return ins[0].id
    }).then(id => insertedIds.push(id)).catch(e => errors.push({ i, err: e.message }))
  })
  await Promise.all(promises)
  const elapsedInsert = Date.now() - t0
  console.log(`Insertados: ${insertedIds.length}/${N} en ${elapsedInsert}ms (${errors.length} errores)`)
  if (errors.length) for (const e of errors.slice(0, 3)) console.log('  ERR:', e.err.slice(0,100))

  // Verificar deltas
  const after = await snapshot(userId)
  const nCorrect = N * CORRECT_RATIO
  const totalTime = N * TIME_PER_Q
  const expectedINS = {
    uss_q: N, uss_c: nCorrect, uss_t: totalTime,
    diff_q: N, diff_c: nCorrect, diff_t: totalTime,
    hour_q: N, hour_c: nCorrect,
    art_q: N, art_c: nCorrect,
    day_q: N, day_c: nCorrect, day_t: totalTime,
  }
  console.log('\n=== Verificación tras INSERTs ===')
  const r1 = diff(after, before, expectedINS)
  for (const l of r1.lines) console.log(l)

  // DELETE las 100 filas
  console.log(`\nDELETE ${insertedIds.length} filas para limpiar...`)
  const t1 = Date.now()
  // En paralelo también, en lotes de 10
  const delPromises = insertedIds.map(id => sql`DELETE FROM test_questions WHERE id = ${id}`)
  await Promise.all(delPromises)
  const elapsedDelete = Date.now() - t1
  console.log(`Borradas en ${elapsedDelete}ms`)

  // Verificar idempotencia: counters deben volver al snapshot original
  const final = await snapshot(userId)
  console.log('\n=== Verificación tras DELETEs (counters deben volver al snapshot original) ===')
  const expectedDEL = {
    uss_q: 0, uss_c: 0, uss_t: 0,
    diff_q: 0, diff_c: 0, diff_t: 0,
    hour_q: 0, hour_c: 0,
    art_q: 0, art_c: 0,
    day_q: 0, day_c: 0, day_t: 0,
  }
  const r2 = diff(final, before, expectedDEL)
  for (const l of r2.lines) console.log(l)

  console.log(`\n${r1.ok && r2.ok ? '🟢 SIN RACE CONDITION' : '🔴 RACE DETECTADO'}`)
  console.log(`\nDuración: ${elapsedInsert}ms INSERT, ${elapsedDelete}ms DELETE`)
  console.log(`Throughput INSERT: ${(N * 1000 / elapsedInsert).toFixed(0)} inserts/s`)
} finally {
  await sql.end()
}
