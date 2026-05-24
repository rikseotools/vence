// lib/api/stats/queries.ts
//
// Queries para /api/stats. Lee de tablas materializadas mantenidas por
// triggers sobre test_questions/tests — lookup PK <10ms en lugar de
// scan. Tablas materializadas:
//   - user_stats_summary       (main stats + total_time + total_tests)
//   - user_difficulty_stats    (por difficulty)
//   - user_hourly_stats        (por hora)
//   - user_article_stats       (por artículo)
//   - user_daily_stats         (por día)
//
// Cutover v1→v2 completado 2026-05-23 — ver docs/ARCHITECTURE_ROADMAP.md
// sección "Validación activa pre-canary" para la story del canary y el
// bug del trigger que detectó el cron de drift.
//
// Lo que NO está materializado y se calcula ad-hoc:
//   - bestScore             (MAX query, Bitmap Index Scan ~3ms)
//   - averageSessionMinutes (AVG sobre tests, ~3ms)
//   - getRecentTests, getThemePerformance, getStreakData,
//     getUserOposicion, getUserSessionsData (cada una tiene su patrón:
//     lookup PK, cache write-through, o tabla pequeña).

import { getDb, getPoolerDb } from '@/db/client'
import { tests, testQuestions, userStreaks, userProfiles, oposiciones, userSessions, topics } from '@/db/schema'
import { eq, and, desc, sql, isNotNull } from 'drizzle-orm'
import type {
  GetUserStatsResponse,
  MainStats,
  WeeklyProgress,
  RecentTest,
  ThemePerformance,
  DifficultyBreakdown,
  TimePatterns,
  ArticlePerformance,
  UserOposicion,
} from './schemas'
import { getUserThemeStatsByOposicion } from '@/lib/api/theme-stats/queries'
import { ALL_OPOSICION_SLUGS, SLUG_TO_POSITION_TYPE } from '@/lib/config/oposiciones'
import type { OposicionSlug } from '@/lib/api/theme-stats/schemas'

const oposicionSlugSet = new Set<string>(ALL_OPOSICION_SLUGS)

function getStatsDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

// Cache en memoria — desactivado para UX inmediata (el usuario espera ver su test recién completado).
const statsCache = new Map<string, { data: GetUserStatsResponse; timestamp: number }>()
const CACHE_TTL = 0

/**
 * Write-through cache: guarda el resultado calculado en tiempo real
 * en la tabla user_theme_performance_cache para evitar recalcular.
 */
async function writeThemePerformanceToCache(
  db: ReturnType<typeof getDb>,
  userId: string,
  data: ThemePerformance[]
): Promise<void> {
  if (!data || data.length === 0) return

  const values = data.map(d =>
    `(${[
      `'${userId}'::uuid`,
      d.temaNumber,
      `'${(d.title || '').replace(/'/g, "''")}'`,
      d.totalQuestions,
      d.correctAnswers,
      d.accuracy,
      d.averageTime,
      d.lastPracticed ? `'${d.lastPracticed}'::timestamptz` : 'NULL',
      'NOW()',
    ].join(', ')})`
  ).join(',\n')

  try {
    await db.execute(sql.raw(`
      INSERT INTO user_theme_performance_cache
        (user_id, topic_number, topic_title, total_questions, correct_answers,
         accuracy, average_time, last_practiced, calculated_at)
      VALUES ${values}
      ON CONFLICT (user_id, topic_number) DO UPDATE SET
        topic_title = EXCLUDED.topic_title,
        total_questions = EXCLUDED.total_questions,
        correct_answers = EXCLUDED.correct_answers,
        accuracy = EXCLUDED.accuracy,
        average_time = EXCLUDED.average_time,
        last_practiced = EXCLUDED.last_practiced,
        calculated_at = EXCLUDED.calculated_at
    `))
    console.log(`💾 Write-through cache: ${data.length} temas guardados para usuario ${userId.slice(0, 8)}...`)
  } catch (err) {
    console.warn('⚠️ Error en write-through cache:', err)
  }
}

// ============================================
// FUNCIÓN PRINCIPAL - Obtener todas las estadísticas
// ============================================

export async function getUserStats(userId: string): Promise<GetUserStatsResponse> {
  try {
    const cached = statsCache.get(userId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.data, cached: true }
    }

    const response = await getUserStatsWithDrizzle(userId)

    statsCache.set(userId, { data: response, timestamp: Date.now() })

    return response
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// Queries Drizzle en paralelo (10 queries: 8 stats + userOposicion + userSessions)
async function getUserStatsWithDrizzle(userId: string): Promise<GetUserStatsResponse> {
  const db = getStatsDb()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    mainStats,
    weeklyProgress,
    recentTests,
    themePerformance,
    difficultyBreakdown,
    timePatterns,
    articleStats,
    streakData,
    userOposicion,
    userSessionsData,
  ] = await Promise.all([
    getMainStats(db, userId),
    getWeeklyProgress(db, userId, thirtyDaysAgo),
    getRecentTests(db, userId),
    getThemePerformance(db, userId),
    getDifficultyBreakdown(db, userId),
    getTimePatterns(db, userId),
    getArticleStats(db, userId),
    getStreakData(db, userId),
    getUserOposicion(db, userId),
    getUserSessionsData(db, userId),
  ])

  const combinedMainStats: MainStats = {
    ...mainStats,
    currentStreak: streakData?.currentStreak ?? 0,
    longestStreak: streakData?.longestStreak ?? 0,
  }

  const weakArticles = articleStats.filter(a => a.accuracy < 60).slice(0, 10)
  const strongArticles = articleStats.filter(a => a.accuracy >= 80).slice(0, 10)

  return {
    success: true,
    stats: {
      main: combinedMainStats,
      weeklyProgress,
      recentTests,
      themePerformance,
      difficultyBreakdown,
      timePatterns,
      weakArticles,
      strongArticles,
      allArticles: articleStats,
      userOposicion: userOposicion ?? undefined,
      userSessions: userSessionsData,
    },
    generatedAt: now.toISOString(),
  }
}

// ════════════════════════════════════════════════════════════════════
// QUERIES DE STATS MATERIALIZADAS
// ════════════════════════════════════════════════════════════════════

// ─── getMainStats ───
// Lee user_stats_summary (lookup PK) + bestScore ad-hoc sobre tests.

async function getMainStats(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<Omit<MainStats, 'currentStreak' | 'longestStreak'>> {
  // user_stats_summary aún no está en db/schema.ts (drizzle-kit
  // introspect pendiente); SQL raw mientras tanto.
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

  // bestScore: query ad-hoc (Bitmap Index Scan, ~3ms). No se
  // materializa porque MAX no es incrementalmente mantenible (un test
  // que se "des-completa" requeriría recalcular el MAX).
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

// ─── getDifficultyBreakdown ───
// Lee user_difficulty_stats (PK lookup). Max 4 filas por user. <1ms.

async function getDifficultyBreakdown(
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
      // averageTime ≈ AVG(time_spent_seconds) porque
      // test_questions.time_spent_seconds tiene 0 NULLs en producción
      // (verificado 23/05/2026: 1.220.927 filas, 0 NULLs).
      averageTime: total > 0 ? Math.round(totalTime / total) : 0,
    }
  })
}

// ─── getTimePatterns ───
// hourlyDistribution: lee user_hourly_stats (lookup PK, max 24 filas).
// averageSessionMinutes: ad-hoc sobre tests — NO se materializa porque
// tests.total_time_seconds diverge 200% de SUM(tq.time_spent_seconds) en
// producción. Mantener ad-hoc preserva compatibilidad exacta con UX
// previa.

async function getTimePatterns(
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

  const significantHours = hourlyDistribution.filter(h => h.questions >= 10)
  const sortedByAccuracy = [...significantHours].sort((a, b) => b.accuracy - a.accuracy)

  const bestHours = sortedByAccuracy.slice(0, 3).map(h => h.hour)
  const worstHours = sortedByAccuracy.slice(-3).map(h => h.hour)

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

// ─── getArticleStats ───
// Lee user_article_stats con filtro total_questions >= 2 (igual que v1).

async function getArticleStats(
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

// ─── getWeeklyProgress ───
// Lee user_daily_stats con filtro day >= since::date. Índice
// (user_id, day DESC) sirve sin sort.

async function getWeeklyProgress(
  db: ReturnType<typeof getDb>,
  userId: string,
  since: Date,
): Promise<WeeklyProgress[]> {
  const sinceDate = since.toISOString().slice(0, 10)
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
// QUERIES NO MATERIALIZADAS (lookup PK directo o cache write-through)
// ════════════════════════════════════════════════════════════════════

async function getRecentTests(db: ReturnType<typeof getDb>, userId: string): Promise<RecentTest[]> {
  const profileRow = await db
    .select({ targetOposicion: userProfiles.targetOposicion })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)
  const positionType = profileRow[0]?.targetOposicion?.replace(/-/g, '_') || 'auxiliar_administrativo_estado'

  // Query con LEFT JOIN LATERAL a topics y test_questions (Memoize de
  // PostgreSQL — 1.8ms vs 8.4s de subqueries correladas).
  const result = await db.execute(
    sql`SELECT
      tests.id, tests.title, tests.tema_number as "temaNumber",
      COALESCE(tests.score::int, 0) as score,
      COALESCE(tests.total_questions, 0) as "totalQuestions",
      tests.completed_at as "completedAt",
      COALESCE(tests.total_time_seconds, 0) as "timeSeconds",
      topic_info.title as "topicTitle",
      topic_info.position_type as "topicPositionType",
      tq_law.law_name as "lawName"
    FROM tests
    LEFT JOIN LATERAL (
      SELECT t.title, t.position_type FROM topics t
      WHERE t.topic_number = tests.tema_number AND t.is_active = true
      ORDER BY CASE WHEN t.position_type = ${positionType} THEN 0 ELSE 1 END
      LIMIT 1
    ) topic_info ON true
    LEFT JOIN LATERAL (
      SELECT tq.law_name FROM test_questions tq
      WHERE tq.test_id = tests.id AND tq.law_name IS NOT NULL
      LIMIT 1
    ) tq_law ON true
    WHERE tests.user_id = ${userId} AND tests.is_completed = true AND tests.completed_at IS NOT NULL
    ORDER BY tests.completed_at DESC
    LIMIT 10`
  ) as unknown as Array<{
    id: string; title: string | null; temaNumber: number | null;
    score: number; totalQuestions: number; completedAt: string | null;
    timeSeconds: number; topicTitle: string | null; topicPositionType: string | null;
    lawName: string | null;
  }>

  return result.map(row => ({
    id: row.id,
    title: row.title,
    temaNumber: row.temaNumber,
    topicTitle: row.topicTitle || null,
    topicPositionType: row.topicPositionType || null,
    lawName: row.lawName || null,
    score: row.score,
    totalQuestions: row.totalQuestions,
    accuracy: row.totalQuestions > 0 ? Math.round((row.score / row.totalQuestions) * 100) : 0,
    completedAt: row.completedAt || '',
    timeSeconds: row.timeSeconds,
  }))
}

async function getThemePerformance(db: ReturnType<typeof getDb>, userId: string): Promise<ThemePerformance[]> {
  const profileRow = await db
    .select({ targetOposicion: userProfiles.targetOposicion })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)
  const targetOposicion = profileRow[0]?.targetOposicion

  // user_profiles.target_oposicion se guarda en formato position_type
  // (underscore), p. ej. "administrativo_seguridad_social". Para usar el
  // módulo topic-progress lo convertimos a slug (guiones).
  const oposicionSlug = targetOposicion ? targetOposicion.replace(/_/g, '-') : null

  // V3 (2026-05-24): si el user tiene target_oposicion conocido, derivar stats
  // dinámicamente desde article_id + topic_scope de esa oposición (módulo
  // topic-progress). Esto evita la trampa de agrupar por tema_number, que es
  // solo un int sin contexto y colisiona entre B2 de oposiciones distintas
  // (p.ej. T101 AAE "Atención al ciudadano" vs T101 SS "SS en la CE").
  //
  // Si la oposición no es reconocida o la V3 falla, caemos al comportamiento
  // legacy. Esto preserva backward compat para usuarios con target_oposicion
  // null o slug obsoleto.
  if (oposicionSlug && oposicionSlugSet.has(oposicionSlug)) {
    try {
      const v3 = await getUserThemeStatsByOposicion(userId, oposicionSlug as OposicionSlug)
      if (v3.success && v3.stats) {
        const positionType = SLUG_TO_POSITION_TYPE[oposicionSlug as OposicionSlug]

        // Resolver títulos de topics de esta oposición (una sola query).
        const topicsRows = await db
          .select({
            topicNumber: topics.topicNumber,
            title: topics.title,
            positionType: topics.positionType,
          })
          .from(topics)
          .where(and(eq(topics.positionType, positionType), eq(topics.isActive, true)))

        const titleByNum: Record<number, { title: string | null; positionType: string | null }> = {}
        for (const t of topicsRows) {
          if (t.topicNumber != null) {
            titleByNum[t.topicNumber] = { title: t.title ?? null, positionType: t.positionType ?? null }
          }
        }

        return Object.values(v3.stats)
          .map(s => ({
            temaNumber: s.temaNumber,
            title: titleByNum[s.temaNumber]?.title ?? null,
            topicPositionType: titleByNum[s.temaNumber]?.positionType ?? null,
            totalQuestions: s.total,
            correctAnswers: s.correct,
            accuracy: s.accuracy,
            averageTime: s.averageTimeSeconds ?? 0,
            lastPracticed: s.lastStudy,
          }))
          .sort((a, b) => a.temaNumber - b.temaNumber)
      }
    } catch (error) {
      console.warn('⚠️ [getThemePerformance] V3 falló, cae a legacy:', error)
    }
  }

  // === RAMA LEGACY: agrupa por tema_number guardado ===
  // Solo se usa cuando target_oposicion del user es null o no reconocido.
  // Mantiene el comportamiento anterior (con el bug cross-oposición conocido
  // — mejor que romper, ya que ese user no tiene contexto de oposición claro).
  const positionTypeForLegacy = targetOposicion?.replace(/-/g, '_') || 'auxiliar_administrativo_estado'

  try {
    const cacheResult = await db.execute(
      sql`SELECT
          c.topic_number, c.topic_title, c.total_questions, c.correct_answers,
          c.accuracy, c.average_time, c.last_practiced,
          topic_info.title AS resolved_title,
          topic_info.position_type AS topic_position_type
        FROM user_theme_performance_cache c
        LEFT JOIN LATERAL (
          SELECT t.title, t.position_type FROM topics t
          WHERE t.topic_number = c.topic_number AND t.is_active = true
          ORDER BY CASE WHEN t.position_type = ${positionTypeForLegacy} THEN 0 ELSE 1 END
          LIMIT 1
        ) topic_info ON true
        WHERE c.user_id = ${userId}::uuid
        ORDER BY c.topic_number`
    )

    if (cacheResult && Array.isArray(cacheResult) && cacheResult.length > 0) {
      return (cacheResult as any[]).map(row => ({
        temaNumber: row.topic_number,
        title: row.resolved_title || row.topic_title || null,
        topicPositionType: row.topic_position_type || null,
        totalQuestions: Number(row.total_questions) || 0,
        correctAnswers: Number(row.correct_answers) || 0,
        accuracy: Number(row.accuracy) || 0,
        averageTime: Math.round(Number(row.average_time) || 0),
        lastPracticed: row.last_practiced,
      }))
    }
  } catch (error) {
    console.warn('⚠️ Error leyendo caché de theme performance:', error)
  }

  // Fallback Drizzle si la caché está vacía
  const result = await db
    .select({
      temaNumber: testQuestions.temaNumber,
      totalQuestions: sql<number>`COUNT(*)::int`,
      correctAnswers: sql<number>`SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::int`,
      averageTime: sql<number>`COALESCE(AVG(${testQuestions.timeSpentSeconds}), 0)::float`,
      lastPracticed: sql<string>`MAX(${testQuestions.createdAt})`,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(and(
      eq(tests.userId, userId),
      isNotNull(testQuestions.temaNumber)
    ))
    .groupBy(testQuestions.temaNumber)
    .orderBy(testQuestions.temaNumber)

  return result
    .filter(row => row.temaNumber !== null)
    .map(row => ({
      temaNumber: row.temaNumber!,
      totalQuestions: row.totalQuestions,
      correctAnswers: row.correctAnswers,
      accuracy: row.totalQuestions > 0 ? Math.round((row.correctAnswers / row.totalQuestions) * 100) : 0,
      averageTime: Math.round(row.averageTime),
      lastPracticed: row.lastPracticed,
    }))
}

async function getStreakData(db: ReturnType<typeof getDb>, userId: string) {
  const result = await db
    .select({
      currentStreak: userStreaks.currentStreak,
      longestStreak: userStreaks.longestStreak,
    })
    .from(userStreaks)
    .where(eq(userStreaks.userId, userId))
    .limit(1)

  return result[0] || null
}

async function getUserOposicion(db: ReturnType<typeof getDb>, userId: string): Promise<UserOposicion | null> {
  try {
    const profileResult = await db
      .select({
        fullName: userProfiles.fullName,
        targetOposicion: userProfiles.targetOposicion,
        createdAt: userProfiles.createdAt,
        gender: userProfiles.gender,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    const profile = profileResult[0]
    const targetOposicion = profile?.targetOposicion?.replace(/_/g, '-') || null

    const daysSinceJoin = profile?.createdAt
      ? Math.max(1, Math.ceil((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
      : 30

    if (!targetOposicion) {
      return {
        userName: profile?.fullName || null,
        gender: (profile?.gender as 'male' | 'female' | 'other' | 'prefer_not_say' | null) || null,
        slug: null,
        nombre: null,
        tipoAcceso: null,
        examDate: null,
        examDateApproximate: null,
        inscriptionDeadline: null,
        plazas: null,
        plazasLibres: null,
        plazasPromocionInterna: null,
        temasCount: null,
        bloquesCount: null,
        boePublicationDate: null,
        boeReference: null,
        daysSinceJoin,
      }
    }

    const oposicionResult = await db
      .select({
        slug: oposiciones.slug,
        nombre: oposiciones.nombre,
        tipoAcceso: oposiciones.tipoAcceso,
        examDate: oposiciones.examDate,
        examDateApproximate: oposiciones.examDateApproximate,
        inscriptionDeadline: oposiciones.inscriptionDeadline,
        plazasLibres: oposiciones.plazasLibres,
        plazasPromocionInterna: oposiciones.plazasPromocionInterna,
        temasCount: oposiciones.temasCount,
        bloquesCount: oposiciones.bloquesCount,
        boePublicationDate: oposiciones.boePublicationDate,
        boeReference: oposiciones.boeReference,
        programaUrl: oposiciones.programaUrl,
      })
      .from(oposiciones)
      .where(eq(oposiciones.slug, targetOposicion))
      .limit(1)

    const oposicion = oposicionResult[0]

    if (!oposicion) {
      return {
        userName: profile?.fullName || null,
        gender: (profile?.gender as 'male' | 'female' | 'other' | 'prefer_not_say' | null) || null,
        slug: targetOposicion,
        nombre: null,
        tipoAcceso: null,
        examDate: null,
        examDateApproximate: null,
        inscriptionDeadline: null,
        plazas: null,
        plazasLibres: null,
        plazasPromocionInterna: null,
        temasCount: null,
        bloquesCount: null,
        boePublicationDate: null,
        boeReference: null,
        daysSinceJoin,
      }
    }

    return {
      userName: profile?.fullName || null,
      gender: (profile?.gender as 'male' | 'female' | 'other' | 'prefer_not_say' | null) || null,
      slug: oposicion.slug,
      nombre: oposicion.nombre,
      tipoAcceso: oposicion.tipoAcceso || 'libre',
      examDate: oposicion.examDate,
      examDateApproximate: oposicion.examDateApproximate ?? false,
      inscriptionDeadline: oposicion.inscriptionDeadline,
      plazas: (oposicion.plazasLibres || 0) + (oposicion.plazasPromocionInterna || 0),
      plazasLibres: oposicion.plazasLibres || 0,
      plazasPromocionInterna: oposicion.plazasPromocionInterna || 0,
      temasCount: oposicion.temasCount,
      bloquesCount: oposicion.bloquesCount,
      boePublicationDate: oposicion.boePublicationDate,
      boeReference: oposicion.boeReference,
      programaUrl: oposicion.programaUrl || null,
      daysSinceJoin,
    }
  } catch (error) {
    console.error('Error obteniendo oposición del usuario:', error)
    return null
  }
}

async function getUserSessionsData(db: ReturnType<typeof getDb>, userId: string) {
  try {
    const rows = await db
      .select({
        totalDurationMinutes: userSessions.totalDurationMinutes,
        engagementScore: userSessions.engagementScore,
        sessionStart: userSessions.sessionStart,
        testsCompleted: userSessions.testsCompleted,
        questionsAnswered: userSessions.questionsAnswered,
      })
      .from(userSessions)
      .where(eq(userSessions.userId, userId))
      .orderBy(desc(userSessions.sessionStart))
      .limit(100)

    return rows.map(r => ({
      totalDurationMinutes: r.totalDurationMinutes ?? null,
      engagementScore: r.engagementScore ? Number(r.engagementScore) : null,
      sessionStart: r.sessionStart ?? null,
      testsCompleted: r.testsCompleted ?? null,
      questionsAnswered: r.questionsAnswered ?? null,
    }))
  } catch (error) {
    console.warn('⚠️ Error obteniendo sesiones de usuario:', error)
    return []
  }
}

// ============================================
// INVALIDAR CACHE
// ============================================

export function invalidateStatsCache(userId: string): void {
  statsCache.delete(userId)
}

export function clearAllStatsCache(): void {
  statsCache.clear()
}
