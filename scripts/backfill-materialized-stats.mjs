// scripts/backfill-materialized-stats.mjs
//
// Backfill incremental de las 5 tablas materializadas del fix de
// /api/stats (user_difficulty_stats, user_hourly_stats,
// user_article_stats, user_daily_stats, columnas total_tests +
// total_time_seconds en user_stats_summary).
//
// Llamado a mano (off-peak preferiblemente) — no es cron recurrente.
// Idempotente vía tabla auxiliar backfill_materialized_stats_progress.
//
// Flujo:
//   1) Si es la primera ejecución: TRUNCATE las 4 tablas + UPDATE
//      user_stats_summary SET total_tests=0, total_time_seconds=0.
//      Eso descarta lo parcial que los triggers hayan escrito desde su
//      aplicación. Pasamos a estado "vacío predecible".
//   2) Captura t0 = NOW() y lo registra en backfill_progress.
//   3) Bucle por user: agrega test_questions filtrando created_at < t0,
//      INSERT ON CONFLICT DO UPDATE sumando deltas. Race con triggers:
//      cero, porque triggers cubren created_at >= t0.
//   4) Marca user como procesado. Si se aborta, resume desde donde quedó.
//
// Uso:
//   node scripts/backfill-materialized-stats.mjs [--limit=N] [--dry-run]
//   --limit=N   procesar solo los primeros N users (útil para validar)
//   --dry-run   ejecutar dentro de transacción + ROLLBACK; no escribe nada
//
// Verificación recomendada DESPUÉS de correr:
//   - Cron de drift detectará si algún counter diverge >5%
//   - Comparar getMainStats antiguo vs nuevo para 30-50 users sample
//     (eso es task #14 separada)

import postgres from '/home/manuel/Documentos/github/vence/node_modules/postgres/src/index.js'
import dotenv from '/home/manuel/Documentos/github/vence/node_modules/dotenv/lib/main.js'

dotenv.config({ path: '/home/manuel/Documentos/github/vence/.env.local' })

const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const limitArg = args.find(a => a.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : null

const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  prepare: false,
  onnotice: () => {},
})

async function main() {
  console.log(`Backfill materialized stats — dryRun=${isDryRun} limit=${limit ?? '∞'}`)

  // ─── Tabla auxiliar de progreso ──────────────────────────────────
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS backfill_materialized_stats_progress (
      user_id UUID PRIMARY KEY,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INT,
      stats JSONB
    );
  `)

  // ─── Detectar primera ejecución ──────────────────────────────────
  // Si la tabla de progreso está vacía (o solo tiene el marcador), reset.
  const progBefore = await sql`
    SELECT COUNT(*)::int AS n FROM backfill_materialized_stats_progress
    WHERE user_id <> '00000000-0000-0000-0000-000000000000'::uuid
  `
  const isFirstRun = progBefore[0].n === 0

  // ─── t0: timestamp del corte. Si es primera ejecución se reusa NOW.
  //      Si es resume se reusa el t0 anterior (estaba guardado en stats
  //      del marker).
  let t0
  if (isFirstRun) {
    const r = await sql`SELECT NOW() AS now`
    t0 = r[0].now
    console.log(`Primera ejecución. t0 = ${t0.toISOString()}`)

    if (!isDryRun) {
      console.log('TRUNCATE de las 4 tablas + reset de las 2 columnas...')
      await sql.unsafe(`
        TRUNCATE user_difficulty_stats, user_hourly_stats, user_article_stats, user_daily_stats RESTART IDENTITY;
        UPDATE user_stats_summary SET total_tests = 0, total_time_seconds = 0;
      `)
      // Registrar marker con t0.
      // OJO: postgres-js serializa objetos JS directamente a jsonb. Si
      // pasamos JSON.stringify() el binding lo envuelve como string
      // primitivo dentro del jsonb (no como objeto) y stats->>'t0' da
      // null. Pasar el objeto sin stringify para que sea objeto JSON real.
      await sql`
        INSERT INTO backfill_materialized_stats_progress (user_id, completed_at, stats)
        VALUES (
          '00000000-0000-0000-0000-000000000000'::uuid,
          NOW(),
          ${sql.json({ role: 'backfill_start_marker', t0: t0.toISOString() })}
        )
        ON CONFLICT (user_id) DO UPDATE SET completed_at = NOW(), stats = EXCLUDED.stats
      `
    }
  } else {
    // Resume: leer t0 del marker
    const marker = await sql`
      SELECT stats->>'t0' AS t0_str
      FROM backfill_materialized_stats_progress
      WHERE user_id = '00000000-0000-0000-0000-000000000000'::uuid
    `
    if (!marker[0]?.t0_str) throw new Error('Resume: marker no tiene t0')
    t0 = new Date(marker[0].t0_str)
    console.log(`Resume: t0 = ${t0.toISOString()}, ${progBefore[0].n} users procesados ya`)
  }

  // ─── Listar users pendientes ─────────────────────────────────────
  let users
  if (limit) {
    users = await sql`
      SELECT DISTINCT t.user_id
      FROM tests t
      WHERE t.user_id IS NOT NULL
        AND t.created_at < ${t0}
        AND NOT EXISTS (
          SELECT 1 FROM backfill_materialized_stats_progress p WHERE p.user_id = t.user_id
        )
      ORDER BY t.user_id
      LIMIT ${limit}
    `
  } else {
    users = await sql`
      SELECT DISTINCT t.user_id
      FROM tests t
      WHERE t.user_id IS NOT NULL
        AND t.created_at < ${t0}
        AND NOT EXISTS (
          SELECT 1 FROM backfill_materialized_stats_progress p WHERE p.user_id = t.user_id
        )
      ORDER BY t.user_id
    `
  }
  console.log(`Users por procesar: ${users.length}`)

  let processed = 0
  let errors = 0
  const startedAt = Date.now()

  for (const u of users) {
    const userT0 = Date.now()
    try {
      await sql.begin(async (tx) => {
        // ─── user_difficulty_stats ────────────────────────────────
        await tx`
          INSERT INTO user_difficulty_stats (user_id, difficulty, total_questions, correct_answers, total_time_seconds)
          SELECT t.user_id, tq.difficulty,
                 COUNT(*)::int,
                 SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int,
                 COALESCE(SUM(tq.time_spent_seconds), 0)::bigint
          FROM test_questions tq
          JOIN tests t ON t.id = tq.test_id
          WHERE t.user_id = ${u.user_id}
            AND tq.difficulty IS NOT NULL
            AND tq.difficulty IN ('easy','medium','hard','extreme')
            AND tq.created_at < ${t0}
          GROUP BY t.user_id, tq.difficulty
          ON CONFLICT (user_id, difficulty) DO UPDATE SET
            total_questions = user_difficulty_stats.total_questions + EXCLUDED.total_questions,
            correct_answers = user_difficulty_stats.correct_answers + EXCLUDED.correct_answers,
            total_time_seconds = user_difficulty_stats.total_time_seconds + EXCLUDED.total_time_seconds,
            updated_at = NOW()
        `

        // ─── user_hourly_stats ────────────────────────────────────
        await tx`
          INSERT INTO user_hourly_stats (user_id, hour, total_questions, correct_answers)
          SELECT t.user_id,
                 EXTRACT(HOUR FROM tq.created_at AT TIME ZONE 'Europe/Madrid')::SMALLINT,
                 COUNT(*)::int,
                 SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int
          FROM test_questions tq
          JOIN tests t ON t.id = tq.test_id
          WHERE t.user_id = ${u.user_id} AND tq.created_at < ${t0}
          GROUP BY t.user_id, EXTRACT(HOUR FROM tq.created_at AT TIME ZONE 'Europe/Madrid')
          ON CONFLICT (user_id, hour) DO UPDATE SET
            total_questions = user_hourly_stats.total_questions + EXCLUDED.total_questions,
            correct_answers = user_hourly_stats.correct_answers + EXCLUDED.correct_answers,
            updated_at = NOW()
        `

        // ─── user_article_stats ───────────────────────────────────
        // GROUP BY incluye NULLs como valores distintos (semántica
        // estándar de Postgres) — coincide con la query original que
        // agrupa por (article_id, article_number, law_name, tema_number).
        await tx`
          INSERT INTO user_article_stats (user_id, article_id, article_number, law_name, tema_number, total_questions, correct_answers)
          SELECT t.user_id, tq.article_id, tq.article_number, tq.law_name, tq.tema_number,
                 COUNT(*)::int,
                 SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int
          FROM test_questions tq
          JOIN tests t ON t.id = tq.test_id
          WHERE t.user_id = ${u.user_id}
            AND tq.article_number IS NOT NULL
            AND tq.created_at < ${t0}
          GROUP BY t.user_id, tq.article_id, tq.article_number, tq.law_name, tq.tema_number
          ON CONFLICT (user_id, article_id, article_number, law_name, tema_number) DO UPDATE SET
            total_questions = user_article_stats.total_questions + EXCLUDED.total_questions,
            correct_answers = user_article_stats.correct_answers + EXCLUDED.correct_answers,
            updated_at = NOW()
        `

        // ─── user_daily_stats ─────────────────────────────────────
        await tx`
          INSERT INTO user_daily_stats (user_id, day, total_questions, correct_answers, total_time_seconds)
          SELECT t.user_id,
                 (tq.created_at AT TIME ZONE 'Europe/Madrid')::DATE,
                 COUNT(*)::int,
                 SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int,
                 COALESCE(SUM(tq.time_spent_seconds), 0)::bigint
          FROM test_questions tq
          JOIN tests t ON t.id = tq.test_id
          WHERE t.user_id = ${u.user_id} AND tq.created_at < ${t0}
          GROUP BY t.user_id, (tq.created_at AT TIME ZONE 'Europe/Madrid')::DATE
          ON CONFLICT (user_id, day) DO UPDATE SET
            total_questions = user_daily_stats.total_questions + EXCLUDED.total_questions,
            correct_answers = user_daily_stats.correct_answers + EXCLUDED.correct_answers,
            total_time_seconds = user_daily_stats.total_time_seconds + EXCLUDED.total_time_seconds,
            updated_at = NOW()
        `

        // ─── user_stats_summary.total_tests + .total_time_seconds ─
        // total_tests = COUNT(tests donde is_completed AND el test
        //   se cerró antes de t0). Usa created_at como proxy de
        //   "completed_at o updated_at" — algunos tests tienen
        //   completed_at NULL aunque is_completed=true.
        const counts = await tx`
          SELECT
            (SELECT COUNT(*)::int FROM tests
              WHERE user_id = ${u.user_id} AND is_completed = true
                AND created_at < ${t0}) AS tests_count,
            (SELECT COALESCE(SUM(tq.time_spent_seconds), 0)::bigint
              FROM test_questions tq
              JOIN tests t ON t.id = tq.test_id
              WHERE t.user_id = ${u.user_id} AND tq.created_at < ${t0}) AS time_total
        `
        await tx`
          UPDATE user_stats_summary
          SET total_tests = total_tests + ${counts[0].tests_count},
              total_time_seconds = total_time_seconds + ${counts[0].time_total},
              updated_at = NOW()
          WHERE user_id = ${u.user_id}
        `

        // ─── Marcar usuario como procesado ────────────────────────
        const elapsedMs = Date.now() - userT0
        await tx`
          INSERT INTO backfill_materialized_stats_progress (user_id, duration_ms, stats)
          VALUES (
            ${u.user_id},
            ${elapsedMs},
            ${sql.json({
              tests: counts[0].tests_count,
              time_total_s: Number(counts[0].time_total),
            })}
          )
          ON CONFLICT (user_id) DO UPDATE SET completed_at = NOW(), duration_ms = EXCLUDED.duration_ms, stats = EXCLUDED.stats
        `

        if (isDryRun) throw new Error('__DRYRUN_ROLLBACK__')
      })

      processed++
      const elapsed = Date.now() - userT0
      if (processed === 1 || processed % 100 === 0 || elapsed > 1000) {
        const pct = ((processed / users.length) * 100).toFixed(1)
        console.log(`  [${processed}/${users.length} ${pct}%] user ${u.user_id.slice(0, 8)} en ${elapsed}ms`)
      }

      if (isDryRun) {
        console.log(`Dry-run para user ${u.user_id.slice(0, 8)}: OK — aborto`)
        break
      }
    } catch (e) {
      if (e.message?.includes('__DRYRUN_ROLLBACK__')) {
        console.log(`Dry-run para user ${u.user_id.slice(0, 8)}: TX rollback OK`)
        break
      }
      console.error(`  ❌ user ${u.user_id.slice(0, 8)}:`, e.message)
      errors++
    }

    // Sleep 100ms entre users para no saturar
    if (!isDryRun) {
      await new Promise(r => setTimeout(r, 100))
    }
  }

  const totalMs = Date.now() - startedAt
  console.log(`\n✅ Backfill: ${processed} users procesados, ${errors} errores, ${(totalMs / 1000).toFixed(1)}s totales`)

  if (!isDryRun && processed > 0) {
    // Sumario al final
    const summary = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM user_difficulty_stats) AS diff,
        (SELECT COUNT(*)::int FROM user_hourly_stats) AS hour,
        (SELECT COUNT(*)::int FROM user_article_stats) AS art,
        (SELECT COUNT(*)::int FROM user_daily_stats) AS day,
        (SELECT COUNT(*)::int FROM user_stats_summary WHERE total_tests > 0) AS uss_tests,
        (SELECT COUNT(*)::int FROM user_stats_summary WHERE total_time_seconds > 0) AS uss_time
    `
    console.log('\nEstado final de tablas materializadas:')
    console.log(`  user_difficulty_stats: ${summary[0].diff} filas`)
    console.log(`  user_hourly_stats:     ${summary[0].hour} filas`)
    console.log(`  user_article_stats:    ${summary[0].art} filas`)
    console.log(`  user_daily_stats:      ${summary[0].day} filas`)
    console.log(`  user_stats_summary con total_tests > 0: ${summary[0].uss_tests} users`)
    console.log(`  user_stats_summary con total_time > 0:  ${summary[0].uss_time} users`)
  }
}

main()
  .catch(e => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => sql.end())
