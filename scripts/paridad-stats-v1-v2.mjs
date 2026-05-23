#!/usr/bin/env node
// Test de paridad v1 (fresh scan) vs v2 (lookup tablas materializadas)
// para las 5 queries de /api/stats que se conmutan por feature flag
// USE_MATERIALIZED_STATS_PCT. Validación previa al canary.
//
// Esperado por documentación del roadmap (sección "Paridad sanity check"):
//   - getDifficultyBreakdown: paridad EXACTA
//   - getArticleStats:         paridad EXACTA
//   - getTimePatterns hourly:  paridad EXACTA
//   - getMainStats:            v2 >= v1 (v1 filtra is_completed=true, v2 no)
//   - getWeeklyProgress:       v2 >= v1 en primer día (bug TZ de v1)
//
// Falla si alguna divergencia ESTRICTA no cumple la expectativa.
//
// Uso: node scripts/paridad-stats-v1-v2.mjs [sample_size]

import postgresLib from 'postgres'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const postgres = postgresLib.default || postgresLib
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })

const SAMPLE_SIZE = parseInt(process.argv[2] || '30', 10)

function arrEq(a, b, keys) {
  if (a.length !== b.length) return { ok: false, reason: `len ${a.length} vs ${b.length}` }
  for (let i = 0; i < a.length; i++) {
    for (const k of keys) {
      if (String(a[i][k] ?? '') !== String(b[i][k] ?? '')) {
        return { ok: false, reason: `row ${i} key ${k}: ${a[i][k]} vs ${b[i][k]}` }
      }
    }
  }
  return { ok: true }
}

async function pickUsers() {
  // 30 users con datos suficientes para validar (>=50 questions
  // materializadas) y mezcla de tamaños (light, medium, heavy)
  return await sql`
    SELECT user_id, total_questions, total_tests
    FROM user_stats_summary
    WHERE total_questions >= 50
    ORDER BY md5(user_id::text)
    LIMIT ${SAMPLE_SIZE}
  `
}

// ────────────────────────────────────────────────────────────────────
// Comparadores por query
// ────────────────────────────────────────────────────────────────────

async function checkDifficulty(userId) {
  const v1 = await sql`
    SELECT tq.difficulty,
           COUNT(*)::int AS q,
           SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS c
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = ${userId} AND tq.difficulty IS NOT NULL
    GROUP BY tq.difficulty
    ORDER BY tq.difficulty
  `
  const v2 = await sql`
    SELECT difficulty, total_questions::int AS q, correct_answers::int AS c
    FROM user_difficulty_stats
    WHERE user_id = ${userId}
    ORDER BY difficulty
  `
  // Filtrar v1 a las 4 difficulties válidas (mismo filtro del trigger)
  const valid = new Set(['easy', 'medium', 'hard', 'extreme'])
  const v1f = v1.filter(r => valid.has(r.difficulty))
  return arrEq(v1f, v2, ['difficulty', 'q', 'c'])
}

async function checkHourly(userId) {
  const v1 = await sql`
    SELECT EXTRACT(HOUR FROM tq.created_at AT TIME ZONE 'Europe/Madrid')::int AS hour,
           COUNT(*)::int AS q,
           SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS c
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = ${userId}
    GROUP BY 1
    ORDER BY 1
  `
  const v2 = await sql`
    SELECT hour::int AS hour, total_questions::int AS q, correct_answers::int AS c
    FROM user_hourly_stats
    WHERE user_id = ${userId}
    ORDER BY hour
  `
  return arrEq(v1, v2, ['hour', 'q', 'c'])
}

async function checkArticle(userId) {
  // V1 agrupa por (article_id, article_number, law_name, tema_number).
  // V2 hace lo mismo via trigger. Paridad esperada exacta en sums.
  const v1 = await sql`
    SELECT
      COALESCE(tq.article_id::text, '') AS aid,
      COALESCE(tq.article_number, '') AS anum,
      COALESCE(tq.law_name, '') AS lname,
      COALESCE(tq.tema_number, 0) AS tnum,
      COUNT(*)::int AS q,
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS c
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = ${userId} AND tq.article_number IS NOT NULL
    GROUP BY tq.article_id, tq.article_number, tq.law_name, tq.tema_number
    ORDER BY 1, 2, 3, 4
  `
  const v2 = await sql`
    SELECT
      COALESCE(article_id::text, '') AS aid,
      COALESCE(article_number, '') AS anum,
      COALESCE(law_name, '') AS lname,
      COALESCE(tema_number, 0) AS tnum,
      total_questions::int AS q,
      correct_answers::int AS c
    FROM user_article_stats
    WHERE user_id = ${userId}
    ORDER BY 1, 2, 3, 4
  `
  return arrEq(v1, v2, ['aid', 'anum', 'lname', 'tnum', 'q', 'c'])
}

async function checkMainStats(userId) {
  // V1: filtra is_completed=true. V2: cuenta todo lo que pasa por trigger.
  // Esperado: v2.total_questions >= v1.total_questions, mismo correct.
  // No fallar si v2 > v1 (es la decisión documentada).
  const v1 = await sql`
    SELECT
      COUNT(DISTINCT t.id)::int AS total_tests,
      COUNT(tq.id)::int AS total_questions,
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS correct_answers,
      COALESCE(SUM(tq.time_spent_seconds), 0)::bigint AS total_time
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = ${userId} AND t.is_completed = true
  `
  const v2 = await sql`
    SELECT
      total_tests::int AS total_tests,
      total_questions::int AS total_questions,
      correct_answers::int AS correct_answers,
      total_time_seconds::bigint AS total_time
    FROM user_stats_summary WHERE user_id = ${userId}
  `
  const a = v1[0], b = v2[0] || { total_tests: 0, total_questions: 0, correct_answers: 0, total_time: 0n }

  // Reglas: v2 >= v1 (porque v1 filtra is_completed=true)
  const checks = []
  if (b.total_tests < a.total_tests) checks.push(`total_tests v2<${a.total_tests}`)
  if (b.total_questions < a.total_questions) checks.push(`total_questions v2<${a.total_questions}`)
  if (b.correct_answers < a.correct_answers) checks.push(`correct_answers v2<${a.correct_answers}`)
  if (BigInt(b.total_time) < BigInt(a.total_time)) checks.push(`total_time v2<${a.total_time}`)

  return {
    ok: checks.length === 0,
    reason: checks.length ? checks.join('; ') : null,
    delta: {
      tq: Number(b.total_questions) - Number(a.total_questions),
      tt: Number(b.total_tests) - Number(a.total_tests),
    },
  }
}

async function checkWeekly(userId) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const sinceISO = since.toISOString()
  const sinceDate = sinceISO.slice(0, 10)

  const v1 = await sql`
    SELECT
      DATE(tq.created_at AT TIME ZONE 'Europe/Madrid')::text AS day,
      COUNT(*)::int AS q,
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS c
    FROM test_questions tq
    INNER JOIN tests t ON t.id = tq.test_id
    WHERE t.user_id = ${userId} AND tq.created_at >= ${sinceISO}
    GROUP BY 1 ORDER BY 1
  `
  const v2 = await sql`
    SELECT to_char(day, 'YYYY-MM-DD') AS day,
           total_questions::int AS q,
           correct_answers::int AS c
    FROM user_daily_stats
    WHERE user_id = ${userId} AND day >= ${sinceDate}::date
    ORDER BY day
  `
  // V2 puede tener más días (bug TZ v1 sub-cuenta primer día UTC) o
  // mismo. Esperado: cada día presente en ambos, v2.q >= v1.q.
  // Mapas por día
  const m1 = new Map(v1.map(r => [r.day, r]))
  const m2 = new Map(v2.map(r => [r.day, r]))
  const allDays = new Set([...m1.keys(), ...m2.keys()])
  const fails = []
  for (const d of allDays) {
    const r1 = m1.get(d) || { q: 0, c: 0 }
    const r2 = m2.get(d) || { q: 0, c: 0 }
    // En v1 puede no haber el primer día (bug TZ); v2 sí. Aceptable.
    // Pero v2 nunca debería ser MENOR que v1.
    if (r2.q < r1.q) fails.push(`${d}: v2 q=${r2.q} < v1 q=${r1.q}`)
  }
  return { ok: fails.length === 0, reason: fails.join('; ') || null, days1: v1.length, days2: v2.length }
}

// ────────────────────────────────────────────────────────────────────
// Run
// ────────────────────────────────────────────────────────────────────

;(async () => {
  console.log(`Paridad v1 vs v2 sobre ${SAMPLE_SIZE} users...`)
  const users = await pickUsers()
  console.log(`Muestreados ${users.length} users\n`)

  const summary = {
    difficulty: { pass: 0, fail: 0, fails: [] },
    hourly: { pass: 0, fail: 0, fails: [] },
    article: { pass: 0, fail: 0, fails: [] },
    main: { pass: 0, fail: 0, fails: [] },
    weekly: { pass: 0, fail: 0, fails: [] },
  }

  for (let i = 0; i < users.length; i++) {
    const u = users[i]
    const uid = u.user_id
    const tag = `${uid.slice(0, 8)} (q=${u.total_questions})`

    const [d, h, a, m, w] = await Promise.all([
      checkDifficulty(uid),
      checkHourly(uid),
      checkArticle(uid),
      checkMainStats(uid),
      checkWeekly(uid),
    ])

    for (const [k, r] of [['difficulty', d], ['hourly', h], ['article', a], ['main', m], ['weekly', w]]) {
      if (r.ok) summary[k].pass++
      else {
        summary[k].fail++
        summary[k].fails.push(`${tag}: ${r.reason}`)
      }
    }

    if (i % 10 === 9) console.log(`  ... ${i + 1}/${users.length}`)
  }

  console.log('\n══════════════════════════════════════════════════')
  console.log('RESULTADO PARIDAD v1 vs v2')
  console.log('══════════════════════════════════════════════════')
  for (const [k, s] of Object.entries(summary)) {
    const verdict = s.fail === 0 ? '✅' : '❌'
    console.log(`${verdict} ${k.padEnd(12)} pass=${s.pass} fail=${s.fail}`)
    for (const f of s.fails.slice(0, 5)) console.log('     -', f)
    if (s.fails.length > 5) console.log(`     ... y ${s.fails.length - 5} más`)
  }

  const allOk = Object.values(summary).every(s => s.fail === 0)
  console.log('\nVeredicto:', allOk ? '✅ PARIDAD OK — apto para canary' : '❌ DIVERGENCIAS — investigar antes del canary')

  await sql.end()
  process.exit(allOk ? 0 : 1)
})().catch(err => {
  console.error('ERROR:', err)
  process.exit(2)
})
