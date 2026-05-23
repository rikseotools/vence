// lib/api/stats/queries-v2.ts
//
// Versión reescrita de las 5 queries lentas de /api/stats para leer de
// tablas materializadas en lugar de escanear test_questions.
//
// Sustituye a (en queries.ts):
//   getMainStats          → getMainStatsV2
//   getDifficultyBreakdown → getDifficultyBreakdownV2
//   getTimePatterns        → getTimePatternsV2
//   getArticleStats        → getArticleStatsV2
//   getWeeklyProgress      → getWeeklyProgressV2
//
// Las otras funciones (getRecentTests, getThemePerformance, getStreakData,
// getUserOposicion, getUserSessionsData) no cambian — ya son lookup PK o
// están materializadas.
//
// CUTOVER: activado por feature flag USE_MATERIALIZED_STATS=true en env.
// Si flag es false (default), getUserStats sigue usando las funciones v1.
// Esto permite canary controlado y rollback inmediato sin redeploy.
//
// Lo que NO se materializa y queda ad-hoc:
//   - bestScore (MAX query, 2.6ms BD, EXPLAIN Bitmap Index Scan)
//   - averageSessionMinutes (AVG(tests.total_time_seconds) — el campo
//     diverge 200% de SUM(tq.time_spent_seconds), si lo materializamos
//     desde test_questions cambia la semántica que el usuario ve. Ad-hoc
//     mantiene compatibilidad exacta.)
//
// Razonamiento + paridad validada (5 users iniciales con counters
// idénticos al fresh scan) → ver
// docs/ARCHITECTURE_ROADMAP.md sección ADR triggers SQL vs outbox/worker.

import { getDb, getPoolerDb } from '@/db/client'
import { tests } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import type {
  MainStats,
  WeeklyProgress,
  DifficultyBreakdown,
  TimePatterns,
  ArticlePerformance,
} from './schemas'

function getStatsDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

// ════════════════════════════════════════════════════════════════════
// 1) getMainStatsV2
// ════════════════════════════════════════════════════════════════════
//
// Lee de:
//   - user_stats_summary (lookup PK): total_questions, correct_answers,
//     total_tests, total_time_seconds, blank_answers
//   - tests (Bitmap Index Scan, 2.6ms): MAX(score/total_questions)
//
// Antes: 2 queries que escaneaban test_questions completo.
// Ahora: 2 lookups indexados.

export async function getMainStatsV2(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<Omit<MainStats, 'currentStreak' | 'longestStreak'>> {
  // Lookup PK en user_stats_summary.
  // Usamos SQL raw porque user_stats_summary aún no está en
  // db/schema.ts (drizzle-kit introspect pendiente; regenerar el
  // schema completo es trabajo aparte que reescribe ~85 tablas).
  const summary = await db.execute(sql`
    SELECT
      COALESCE(total_questions, 0)::int      AS total_questions,
      COALESCE(correct_answers, 0)::int      AS correct_answers,
      COALESCE(total_tests, 0)::int          AS total_tests,
      COALESCE(total_time_seconds, 0)        AS total_time_seconds
    FROM user_stats_summary
    WHERE user_id = ${userId}::uuid
    LIMIT 1
  `) as unknown as Array<{
    total_questions: number
    correct_answers: number
    total_tests: number
    total_time_seconds: string | number
  }>

  const row = summary[0]
  const totalQuestions = row?.total_questions ?? 0
  const correctAnswers = row?.correct_answers ?? 0
  const totalTests = row?.total_tests ?? 0
  const totalTimeSeconds = Number(row?.total_time_seconds ?? 0)

  // bestScore: query ad-hoc sobre tests (Bitmap Index Scan, ~3ms BD).
  // No se materializa porque MAX no es incrementalmente mantenible
  // (un test que se "des-completa" requeriría recalcular el MAX).
  const bestScoreResult = await db
    .select({
      bestScore: sql<number>`COALESCE(MAX(CASE WHEN ${tests.totalQuestions} > 0
        THEN (${tests.score}::float / ${tests.totalQuestions} * 100)
        ELSE 0 END), 0)::int`,
    })
    .from(tests)
    .where(and(
      eq(tests.userId, userId),
      eq(tests.isCompleted, true),
    ))

  const accuracy = totalQuestions > 0
    ? Math.round((correctAnswers / totalQuestions) * 100)
    : 0

  const averageTimePerQuestion = totalQuestions > 0
    ? Math.round(totalTimeSeconds / totalQuestions)
    : 0

  return {
    totalTests,
    totalQuestions,
    correctAnswers,
    accuracy,
    totalStudyTimeSeconds: totalTimeSeconds,
    averageTimePerQuestion,
    bestScore: bestScoreResult[0]?.bestScore || 0,
  }
}

// ════════════════════════════════════════════════════════════════════
// 2) getDifficultyBreakdownV2
// ════════════════════════════════════════════════════════════════════
//
// Lee de user_difficulty_stats (PK lookup por user_id).
// Max 4 filas por user. <1ms.

export async function getDifficultyBreakdownV2(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<DifficultyBreakdown[]> {
  const result = await db.execute(sql`
    SELECT
      difficulty,
      total_questions::int   AS total_questions,
      correct_answers::int   AS correct_answers,
      total_time_seconds     AS total_time_seconds
    FROM user_difficulty_stats
    WHERE user_id = ${userId}::uuid
  `) as unknown as Array<{
    difficulty: string
    total_questions: number
    correct_answers: number
    total_time_seconds: string | number
  }>

  return result.map(row => {
    const total = row.total_questions
    const correct = row.correct_answers
    const totalTime = Number(row.total_time_seconds)
    return {
      difficulty: row.difficulty,
      totalQuestions: total,
      correctAnswers: correct,
      accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      // averageTime: equivalente a AVG(time_spent_seconds) porque
      // test_questions.time_spent_seconds tiene 0 NULLs en producción
      // (verificado 23/05/2026: 1.220.927 filas, 0 NULLs).
      averageTime: total > 0 ? Math.round(totalTime / total) : 0,
    }
  })
}

// ════════════════════════════════════════════════════════════════════
// 3) getTimePatternsV2
// ════════════════════════════════════════════════════════════════════
//
// hourlyDistribution: lee de user_hourly_stats (lookup PK, max 24 filas).
// averageSessionMinutes: ad-hoc sobre tests — NO se materializa porque
// tests.total_time_seconds diverge 200% de SUM(tq.time_spent_seconds) en
// producción (medido 23/05/2026). Si reemplazo, cambio la semántica que
// el usuario ve. Mantener ad-hoc preserva compatibilidad exacta.

export async function getTimePatternsV2(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<TimePatterns> {
  const hourlyResult = await db.execute(sql`
    SELECT
      hour::int               AS hour,
      total_questions::int    AS questions,
      correct_answers::int    AS correct
    FROM user_hourly_stats
    WHERE user_id = ${userId}::uuid
    ORDER BY hour
  `) as unknown as Array<{ hour: number; questions: number; correct: number }>

  const hourlyDistribution = hourlyResult.map(row => ({
    hour: row.hour,
    questions: row.questions,
    accuracy: row.questions > 0 ? Math.round((row.correct / row.questions) * 100) : 0,
  }))

  // Identificar mejores y peores horas (mínimo 10 preguntas para ser significativo)
  // Mismo cálculo que v1 — se hace en JS.
  const significantHours = hourlyDistribution.filter(h => h.questions >= 10)
  const sortedByAccuracy = [...significantHours].sort((a, b) => b.accuracy - a.accuracy)

  const bestHours = sortedByAccuracy.slice(0, 3).map(h => h.hour)
  const worstHours = sortedByAccuracy.slice(-3).map(h => h.hour)

  // Sesión promedio: ad-hoc query sobre tests (Bitmap Index Scan, ~3ms).
  const sessionResult = await db
    .select({
      avgMinutes: sql<number>`COALESCE(AVG(${tests.totalTimeSeconds}) / 60, 0)::float`,
    })
    .from(tests)
    .where(and(
      eq(tests.userId, userId),
      eq(tests.isCompleted, true),
    ))

  return {
    hourlyDistribution,
    bestHours,
    worstHours,
    averageSessionMinutes: Math.round(sessionResult[0]?.avgMinutes || 0),
  }
}

// ════════════════════════════════════════════════════════════════════
// 4) getArticleStatsV2
// ════════════════════════════════════════════════════════════════════
//
// Lee de user_article_stats (índice parcial sobre la expresión
// accuracy ASC, WHERE total_questions >= 2).

export async function getArticleStatsV2(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<ArticlePerformance[]> {
  const result = await db.execute(sql`
    SELECT
      article_id            AS "articleId",
      article_number        AS "articleNumber",
      law_name              AS "lawName",
      tema_number           AS "temaNumber",
      total_questions::int  AS "totalQuestions",
      correct_answers::int  AS "correctAnswers"
    FROM user_article_stats
    WHERE user_id = ${userId}::uuid
      AND total_questions >= 2
    ORDER BY (correct_answers::float / total_questions) ASC
  `) as unknown as Array<{
    articleId: string | null
    articleNumber: string | null
    lawName: string | null
    temaNumber: number | null
    totalQuestions: number
    correctAnswers: number
  }>

  return result.map(row => ({
    articleId: row.articleId,
    articleNumber: row.articleNumber,
    lawName: row.lawName,
    temaNumber: row.temaNumber,
    totalQuestions: row.totalQuestions,
    correctAnswers: row.correctAnswers,
    accuracy: row.totalQuestions > 0
      ? Math.round((row.correctAnswers / row.totalQuestions) * 100)
      : 0,
  }))
}

// ════════════════════════════════════════════════════════════════════
// 5) getWeeklyProgressV2
// ════════════════════════════════════════════════════════════════════
//
// Lee de user_daily_stats. Pide últimos 30 días (igual que v1).
// Índice (user_id, day DESC) sirve sin sort.

export async function getWeeklyProgressV2(
  db: ReturnType<typeof getDb>,
  userId: string,
  since: Date,
): Promise<WeeklyProgress[]> {
  const sinceDate = since.toISOString().slice(0, 10) // YYYY-MM-DD
  const result = await db.execute(sql`
    SELECT
      to_char(day, 'YYYY-MM-DD')   AS date,
      total_questions::int          AS questions,
      correct_answers::int          AS correct,
      total_time_seconds            AS study_seconds
    FROM user_daily_stats
    WHERE user_id = ${userId}::uuid
      AND day >= ${sinceDate}::date
    ORDER BY day
  `) as unknown as Array<{
    date: string
    questions: number
    correct: number
    study_seconds: string | number
  }>

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return result.map(row => {
    const date = new Date(row.date)
    const studySeconds = Number(row.study_seconds)
    return {
      day: dayNames[date.getUTCDay()],
      date: row.date,
      questions: row.questions,
      correct: row.correct,
      accuracy: row.questions > 0 ? Math.round((row.correct / row.questions) * 100) : 0,
      studyMinutes: Math.round(studySeconds / 60),
    }
  })
}

// ════════════════════════════════════════════════════════════════════
// Feature flag helper
// ════════════════════════════════════════════════════════════════════
//
// Activar la versión nueva configurando USE_MATERIALIZED_STATS=true en
// env. Rollback inmediato sin redeploy: cambiar la env var a false.
//
// Canary por % usuarios (futuro): si USE_MATERIALIZED_STATS_PCT está
// definido, hashea el user_id y compara contra el %.

export function shouldUseMaterializedStatsFor(userId: string): boolean {
  // Override completo
  if (process.env.USE_MATERIALIZED_STATS === 'true') return true
  if (process.env.USE_MATERIALIZED_STATS === 'false') return false

  // Canary por porcentaje (0-100)
  const pctStr = process.env.USE_MATERIALIZED_STATS_PCT
  if (pctStr) {
    const pct = Number(pctStr)
    if (Number.isFinite(pct) && pct > 0) {
      // Hash determinista del user_id → 0-99
      let hash = 0
      for (let i = 0; i < userId.length; i++) {
        hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0
      }
      const bucket = Math.abs(hash) % 100
      return bucket < pct
    }
  }

  // Default: NO usar materializadas (v1 sigue activo hasta confirmación)
  return false
}
