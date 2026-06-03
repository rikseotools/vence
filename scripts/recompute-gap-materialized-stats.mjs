// scripts/recompute-gap-materialized-stats.mjs
//
// Recompute AUTORITATIVO de las tablas materializadas para los usuarios
// afectados por el hueco del cutover de outbox a medias (2026-06-03 02:03→18:10,
// donde triggers OFF + handlers no-op dejaron de escribir 5 tablas).
//
// A diferencia de scripts/backfill-materialized-stats.mjs (que asume triggers
// SÍNCRONOS para la cola y hace TRUNCATE global), este script:
//   - Es seguro con los handlers async YA VIVOS: UPSERT ABSOLUTO por (user,key)
//     (no TRUNCATE, no DELETE) → no abre ventana de filas ausentes; un increment
//     del handler post-SET suma correctamente; las 5 tablas tienen índices únicos
//     que casan (article_stats es NULLS NOT DISTINCT).
//   - Recomputa el VALOR ABSOLUTO desde test_questions (toda la historia del
//     user), así corrige base incompleta + hueco de una vez, sin depender de
//     deltas ni de t0.
//   - Incluye user_question_history_v2 (al backfill canónico le falta).
//   - Reconstruye user_stats_summary.{total_tests,total_time_seconds} (también
//     dependían del handler congelado), SIN tocar total_questions/correct_answers
//     (que answer-and-save mantiene en vivo).
//
// Semántica de agregación: idéntica a backfill-materialized-stats.mjs (canónico).
//
// Uso:
//   node scripts/recompute-gap-materialized-stats.mjs [--dry-run] [--limit=N] [--user=UUID]

import postgres from '/home/manuel/Documentos/github/vence/node_modules/postgres/src/index.js'
import dotenv from '/home/manuel/Documentos/github/vence/node_modules/dotenv/lib/main.js'

dotenv.config({ path: '/home/manuel/Documentos/github/vence/.env.local' })

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const limitArg = args.find(a => a.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : null
const userArg = args.find(a => a.startsWith('--user='))
const onlyUser = userArg ? userArg.split('=')[1] : null

const GAP_START = '2026-06-03T02:03:00Z'
const GAP_END = '2026-06-03T18:10:00Z'

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false, onnotice: () => {} })

async function recomputeUser(tx, userId) {
  // ── user_question_history_v2 (falta en el canónico) ──
  await tx`
    INSERT INTO user_question_history_v2 (user_id, question_id, total_attempts, correct_attempts, success_rate, first_attempt_at, last_attempt_at, trend)
    SELECT tq.user_id, tq.question_id, COUNT(*)::int,
           SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int,
           ROUND(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::numeric / COUNT(*), 2)::DECIMAL(3,2),
           MIN(tq.created_at), MAX(tq.created_at), 'stable'
    FROM test_questions tq
    WHERE tq.user_id = ${userId} AND tq.question_id IS NOT NULL AND tq.is_correct IS NOT NULL
      AND EXISTS (SELECT 1 FROM questions q WHERE q.id = tq.question_id)
    GROUP BY tq.user_id, tq.question_id
    ON CONFLICT (user_id, question_id) DO UPDATE SET
      total_attempts = EXCLUDED.total_attempts,
      correct_attempts = EXCLUDED.correct_attempts,
      success_rate = EXCLUDED.success_rate,
      first_attempt_at = EXCLUDED.first_attempt_at,
      last_attempt_at = EXCLUDED.last_attempt_at,
      updated_at = NOW()
  `
  // ── user_difficulty_stats ──
  await tx`
    INSERT INTO user_difficulty_stats (user_id, difficulty, total_questions, correct_answers, total_time_seconds)
    SELECT tq.user_id, tq.difficulty, COUNT(*)::int,
           SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int,
           COALESCE(SUM(tq.time_spent_seconds), 0)::bigint
    FROM test_questions tq
    WHERE tq.user_id = ${userId} AND tq.difficulty IN ('easy','medium','hard','extreme')
    GROUP BY tq.user_id, tq.difficulty
    ON CONFLICT (user_id, difficulty) DO UPDATE SET
      total_questions = EXCLUDED.total_questions,
      correct_answers = EXCLUDED.correct_answers,
      total_time_seconds = EXCLUDED.total_time_seconds,
      updated_at = NOW()
  `
  // ── user_hourly_stats ──
  await tx`
    INSERT INTO user_hourly_stats (user_id, hour, total_questions, correct_answers)
    SELECT tq.user_id, EXTRACT(HOUR FROM tq.created_at AT TIME ZONE 'Europe/Madrid')::SMALLINT,
           COUNT(*)::int, SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int
    FROM test_questions tq WHERE tq.user_id = ${userId}
    GROUP BY tq.user_id, EXTRACT(HOUR FROM tq.created_at AT TIME ZONE 'Europe/Madrid')
    ON CONFLICT (user_id, hour) DO UPDATE SET
      total_questions = EXCLUDED.total_questions,
      correct_answers = EXCLUDED.correct_answers,
      updated_at = NOW()
  `
  // ── user_article_stats (índice NULLS NOT DISTINCT → ON CONFLICT casa) ──
  await tx`
    INSERT INTO user_article_stats (user_id, article_id, article_number, law_name, tema_number, total_questions, correct_answers)
    SELECT tq.user_id, tq.article_id, tq.article_number, tq.law_name, tq.tema_number,
           COUNT(*)::int, SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int
    FROM test_questions tq
    WHERE tq.user_id = ${userId} AND tq.article_number IS NOT NULL
    GROUP BY tq.user_id, tq.article_id, tq.article_number, tq.law_name, tq.tema_number
    ON CONFLICT (user_id, article_id, article_number, law_name, tema_number) DO UPDATE SET
      total_questions = EXCLUDED.total_questions,
      correct_answers = EXCLUDED.correct_answers,
      updated_at = NOW()
  `
  // ── user_daily_stats ──
  await tx`
    INSERT INTO user_daily_stats (user_id, day, total_questions, correct_answers, total_time_seconds)
    SELECT tq.user_id, (tq.created_at AT TIME ZONE 'Europe/Madrid')::DATE,
           COUNT(*)::int, SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int,
           COALESCE(SUM(tq.time_spent_seconds), 0)::bigint
    FROM test_questions tq WHERE tq.user_id = ${userId}
    GROUP BY tq.user_id, (tq.created_at AT TIME ZONE 'Europe/Madrid')::DATE
    ON CONFLICT (user_id, day) DO UPDATE SET
      total_questions = EXCLUDED.total_questions,
      correct_answers = EXCLUDED.correct_answers,
      total_time_seconds = EXCLUDED.total_time_seconds,
      updated_at = NOW()
  `
  // ── user_stats_summary.{total_tests,total_time_seconds} (handler-maintained,
  //    también congeladas). NO tocar total_questions/correct_answers (live). ──
  await tx`
    UPDATE user_stats_summary s SET
      total_tests = (SELECT COUNT(*)::int FROM tests WHERE user_id = ${userId} AND is_completed = true),
      total_time_seconds = (SELECT COALESCE(SUM(tq.time_spent_seconds),0)::bigint FROM test_questions tq WHERE tq.user_id = ${userId}),
      updated_at = NOW()
    WHERE s.user_id = ${userId}
  `
}

async function main() {
  console.log(`Recompute gap materialized stats — dryRun=${isDryRun} limit=${limit ?? '∞'} onlyUser=${onlyUser ?? '(afectados)'}`)

  let users
  if (onlyUser) {
    users = [{ user_id: onlyUser }]
  } else {
    users = await sql`
      SELECT DISTINCT user_id FROM test_questions
      WHERE created_at >= ${GAP_START} AND created_at < ${GAP_END} AND user_id IS NOT NULL
      ORDER BY user_id ${limit ? sql`LIMIT ${limit}` : sql``}
    `
  }
  console.log(`Usuarios a recomputar: ${users.length}`)

  let processed = 0, errors = 0
  const startedAt = Date.now()
  for (const u of users) {
    const t0 = Date.now()
    try {
      if (isDryRun) {
        // Dry-run: todo en una TX que se revierte (no escribe nada).
        await sql.begin(async (tx) => {
          await recomputeUser(tx, u.user_id)
          throw new Error('__DRYRUN_ROLLBACK__')
        })
      } else {
        // Real: cada statement auto-commit (NO transacción larga envolvente).
        // Así los locks (sobre todo el de user_stats_summary, que comparte con
        // answer-and-save) se liberan al instante en vez de retenerse ~20s en
        // users pesados → no bloquea el guardado en vivo en hora punta.
        await recomputeUser(sql, u.user_id)
      }
      processed++
      const ms = Date.now() - t0
      if (processed === 1 || processed % 25 === 0 || ms > 1500) {
        console.log(`  [${processed}/${users.length}] ${u.user_id.slice(0,8)} en ${ms}ms`)
      }
    } catch (e) {
      if (e.message?.includes('__DRYRUN_ROLLBACK__')) {
        console.log(`  Dry-run ${u.user_id.slice(0,8)}: TX OK → rollback`); break
      }
      console.error(`  ❌ ${u.user_id.slice(0,8)}: ${e.message}`); errors++
    }
    if (!isDryRun) await new Promise(r => setTimeout(r, 60))
  }
  console.log(`\n✅ ${processed} usuarios recomputados, ${errors} errores, ${((Date.now()-startedAt)/1000).toFixed(1)}s`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) }).finally(() => sql.end())
