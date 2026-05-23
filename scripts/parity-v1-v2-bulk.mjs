// scripts/parity-v1-v2-bulk.mjs
//
// Paridad masiva v1 vs v2 sobre 30 users sample (10 light + 10 medium +
// 10 heavy). Para cada user calcula directamente con SQL los 5
// componentes que reescribimos y compara:
//
//   - getMainStats: total_questions, correct_answers, total_tests,
//     total_time_seconds
//   - getDifficultyBreakdown: 4 difficulties × (total, correct, time)
//   - getTimePatterns: distribución horaria
//   - getArticleStats: sumas totales por user (cada user tiene
//     potencialmente miles de combos)
//   - getWeeklyProgress: últimos 30 días
//
// Distingue:
//   - DIVERGENCIAS ESPERADAS: documentadas en el roadmap (semántica
//     is_completed en getMainStats, bug TZ en getWeeklyProgress).
//   - DIVERGENCIAS INESPERADAS: serían bugs reales del trigger o backfill.
//
// Criterio de cutover: solo las esperadas son aceptables. Cualquier
// inesperada bloquea.

import postgres from '/home/manuel/Documentos/github/vence/node_modules/postgres/src/index.js'
import dotenv from '/home/manuel/Documentos/github/vence/node_modules/dotenv/lib/main.js'

dotenv.config({ path: '/home/manuel/Documentos/github/vence/.env.local' })
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} })

const SAMPLE_SIZE_PER_TIER = 10
const TIERS = [
  { name: 'light', minQ: 1, maxQ: 100 },
  { name: 'medium', minQ: 1000, maxQ: 5000 },
  { name: 'heavy', minQ: 10000, maxQ: 1000000 },
]

try {
  // Capturar t0 del backfill (usado en queries v1 para filtrar igual que v2)
  const t0 = new Date((await sql`SELECT stats->>'t0' AS t FROM backfill_materialized_stats_progress WHERE user_id='00000000-0000-0000-0000-000000000000'::uuid`)[0].t)
  console.log(`t0 backfill: ${t0.toISOString()}\n`)

  // Sample
  const sampleUsers = []
  for (const tier of TIERS) {
    const users = await sql`
      SELECT user_id, total_questions FROM user_stats_summary
      WHERE total_questions BETWEEN ${tier.minQ} AND ${tier.maxQ}
      ORDER BY random() LIMIT ${SAMPLE_SIZE_PER_TIER}
    `
    for (const u of users) sampleUsers.push({ ...u, tier: tier.name })
    console.log(`Tier ${tier.name}: ${users.length} users`)
  }
  console.log(`Total sample: ${sampleUsers.length}`)

  // Contadores agrupados
  const stats = {
    diff_perfect: 0, diff_expected: 0, diff_unexpected: 0,
    cases_diff: [], cases_unexpected: [],
  }

  for (const u of sampleUsers) {
    const userId = u.user_id

    // ─── 1) getMainStats ────────────────────────────────────────
    // v1 (cómputo equivalente a la query original — con filtro is_completed)
    const v1Main = (await sql`
      SELECT
        COUNT(DISTINCT t.id)::int AS total_tests,
        COUNT(tq.id)::int AS total_questions,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS correct_answers,
        COALESCE(SUM(tq.time_spent_seconds),0)::bigint AS total_time_seconds
      FROM test_questions tq
      JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = ${userId} AND t.is_completed = true
        /* sin filtro created_at: v2 ahora tiene backfill + triggers */
    `)[0]
    // v2 (lee de user_stats_summary, sin filtro is_completed)
    const v2Main = (await sql`
      SELECT total_questions, correct_answers, total_tests, total_time_seconds
      FROM user_stats_summary WHERE user_id = ${userId}
    `)[0]

    const mainSameAsExpected =
      v1Main.total_questions === v2Main.total_questions
      && v1Main.correct_answers === v2Main.correct_answers
      && v1Main.total_tests === v2Main.total_tests
      && Number(v1Main.total_time_seconds) === Number(v2Main.total_time_seconds)

    // ─── 2) getDifficultyBreakdown ──────────────────────────────
    const v1Diff = await sql`
      SELECT tq.difficulty,
        COUNT(*)::int AS total_questions,
        SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS correct_answers,
        COALESCE(SUM(tq.time_spent_seconds),0)::bigint AS total_time_seconds
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = ${userId} AND tq.difficulty IN ('easy','medium','hard','extreme')
        /* sin filtro created_at: v2 ahora tiene backfill + triggers */
      GROUP BY tq.difficulty
      ORDER BY tq.difficulty
    `
    const v2Diff = await sql`
      SELECT difficulty, total_questions::int, correct_answers::int, total_time_seconds
      FROM user_difficulty_stats WHERE user_id = ${userId}
      ORDER BY difficulty
    `
    const v1DiffMap = Object.fromEntries(v1Diff.map(r => [r.difficulty, { q: r.total_questions, c: r.correct_answers, t: Number(r.total_time_seconds) }]))
    const v2DiffMap = Object.fromEntries(v2Diff.map(r => [r.difficulty, { q: r.total_questions, c: r.correct_answers, t: Number(r.total_time_seconds) }]))
    let diffOk = true
    for (const d of new Set([...Object.keys(v1DiffMap), ...Object.keys(v2DiffMap)])) {
      const a = v1DiffMap[d], b = v2DiffMap[d]
      if (!a || !b || a.q !== b.q || a.c !== b.c || a.t !== b.t) { diffOk = false; break }
    }

    // ─── 3) getTimePatterns hourly ──────────────────────────────
    const v1Hour = await sql`
      SELECT EXTRACT(HOUR FROM tq.created_at AT TIME ZONE 'Europe/Madrid')::int AS hour,
        COUNT(*)::int AS q, SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS c
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = ${userId} AND tq.created_at < ${t0}
      GROUP BY EXTRACT(HOUR FROM tq.created_at AT TIME ZONE 'Europe/Madrid')
      ORDER BY hour
    `
    const v2Hour = await sql`
      SELECT hour::int, total_questions::int AS q, correct_answers::int AS c
      FROM user_hourly_stats WHERE user_id = ${userId} ORDER BY hour
    `
    const hourOk = JSON.stringify(v1Hour) === JSON.stringify(v2Hour)

    // ─── 4) getArticleStats: sumas totales por user ─────────────
    const v1Art = (await sql`
      SELECT COUNT(*)::int AS rows, SUM(total_questions)::int AS sum_q, SUM(correct_answers)::int AS sum_c
      FROM (
        SELECT tq.article_id, tq.article_number, tq.law_name, tq.tema_number,
          COUNT(*)::int AS total_questions,
          SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS correct_answers
        FROM test_questions tq JOIN tests t ON t.id = tq.test_id
        WHERE t.user_id = ${userId} AND tq.article_number IS NOT NULL AND tq.created_at < ${t0}
        GROUP BY tq.article_id, tq.article_number, tq.law_name, tq.tema_number
        HAVING COUNT(*) >= 2
      ) g
    `)[0]
    const v2Art = (await sql`
      SELECT COUNT(*)::int AS rows, SUM(total_questions)::int AS sum_q, SUM(correct_answers)::int AS sum_c
      FROM user_article_stats WHERE user_id = ${userId} AND total_questions >= 2
    `)[0]
    const artOk = v1Art.rows === v2Art.rows && v1Art.sum_q === v2Art.sum_q && v1Art.sum_c === v2Art.sum_c

    // ─── 5) getWeeklyProgress (últimos 30 días) ─────────────────
    // Para no replicar el bug TZ de v1, hacemos la query "correcta":
    // todos los días en zona Madrid donde el user respondió.
    const v1Week = await sql`
      SELECT (tq.created_at AT TIME ZONE 'Europe/Madrid')::DATE::text AS date,
        COUNT(*)::int AS q, SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS c
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = ${userId}
        AND (tq.created_at AT TIME ZONE 'Europe/Madrid')::DATE >= (NOW() AT TIME ZONE 'Europe/Madrid')::DATE - INTERVAL '30 days'
        /* sin filtro created_at: v2 ahora tiene backfill + triggers */
      GROUP BY (tq.created_at AT TIME ZONE 'Europe/Madrid')::DATE
      ORDER BY date
    `
    const v2Week = await sql`
      SELECT to_char(day, 'YYYY-MM-DD') AS date,
        total_questions::int AS q, correct_answers::int AS c
      FROM user_daily_stats
      WHERE user_id = ${userId} AND day >= (NOW() AT TIME ZONE 'Europe/Madrid')::DATE - INTERVAL '30 days'
      ORDER BY day
    `
    const weekOk = JSON.stringify(v1Week) === JSON.stringify(v2Week)

    // ─── Clasificar resultado del user ──────────────────────────
    const allOk = mainSameAsExpected && diffOk && hourOk && artOk && weekOk
    if (allOk) {
      stats.diff_perfect++
    } else {
      // ¿Es divergencia esperada o inesperada?
      const onlyMainSemanticDiverge = !mainSameAsExpected && diffOk && hourOk && artOk && weekOk
      if (onlyMainSemanticDiverge) {
        stats.diff_expected++
        stats.cases_diff.push({
          user: userId.slice(0,8), tier: u.tier,
          main_v1: { q: v1Main.total_questions, c: v1Main.correct_answers, t: v1Main.total_tests },
          main_v2: { q: v2Main.total_questions, c: v2Main.correct_answers, t: v2Main.total_tests },
        })
      } else {
        stats.diff_unexpected++
        stats.cases_unexpected.push({
          user: userId.slice(0,8), tier: u.tier,
          mainOk: mainSameAsExpected,
          diffOk, hourOk, artOk, weekOk,
        })
      }
    }
  }

  // ─── Reporte final ────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70))
  console.log('RESUMEN DE PARIDAD')
  console.log('═'.repeat(70))
  console.log(`Paridad perfecta:               ${stats.diff_perfect}/${sampleUsers.length}`)
  console.log(`Divergencia esperada (main):    ${stats.diff_expected}/${sampleUsers.length}`)
  console.log(`Divergencia INESPERADA:         ${stats.diff_unexpected}/${sampleUsers.length}`)

  if (stats.cases_diff.length > 0) {
    console.log('\nMuestra de divergencias esperadas (semántica is_completed en getMainStats):')
    for (const c of stats.cases_diff.slice(0, 5)) {
      console.log(`  [${c.tier}] ${c.user}: v1 q=${c.main_v1.q} c=${c.main_v1.c} t=${c.main_v1.t} | v2 q=${c.main_v2.q} c=${c.main_v2.c} t=${c.main_v2.t}`)
    }
  }

  if (stats.cases_unexpected.length > 0) {
    console.log('\n⚠️  INESPERADAS — investigar:')
    for (const c of stats.cases_unexpected) {
      console.log(`  [${c.tier}] ${c.user}: main=${c.mainOk?'✅':'❌'} diff=${c.diffOk?'✅':'❌'} hour=${c.hourOk?'✅':'❌'} art=${c.artOk?'✅':'❌'} week=${c.weekOk?'✅':'❌'}`)
    }
  } else {
    console.log('\n🟢 SIN DIVERGENCIAS INESPERADAS')
  }
} finally {
  await sql.end()
}
