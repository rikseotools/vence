// lib/api/stats/queries.ts - Queries optimizadas para estadísticas de usuario
import { getDb } from '@/db/client'
import { tests, testQuestions, userStreaks, userProfiles, oposiciones, userSessions, topics } from '@/db/schema'
import { eq, and, desc, sql, gte, isNotNull } from 'drizzle-orm'
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

// Cache en memoria — desactivado para UX inmediata (el usuario espera ver su test recién completado)
// Las 10 queries paralelas tardan ~200ms, no necesita caché
const statsCache = new Map<string, { data: GetUserStatsResponse; timestamp: number }>()
const CACHE_TTL = 0 // Sin caché — datos siempre frescos

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
    // Verificar cache
    const cached = statsCache.get(userId)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { ...cached.data, cached: true }
    }

    // Ejecutar queries Drizzle en paralelo (8 stats + userOposicion)
    const response = await getUserStatsWithDrizzle(userId)

    // Guardar en cache
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

// Helper functions
function getDayName(date: Date): string {
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return dayNames[date.getDay()]
}

function getBestHours(hourlyData: Array<{hour: number, questions: number, accuracy: number}>): number[] {
  return hourlyData
    .filter(h => h.questions >= 10)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3)
    .map(h => h.hour)
}

function getWorstHours(hourlyData: Array<{hour: number, questions: number, accuracy: number}>): number[] {
  return hourlyData
    .filter(h => h.questions >= 10)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3)
    .map(h => h.hour)
}

// Queries Drizzle en paralelo (9 queries: 8 stats + userOposicion)
async function getUserStatsWithDrizzle(userId: string): Promise<GetUserStatsResponse> {
  const db = getDb()
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // Ejecutar todas las queries en paralelo
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

  // Combinar streak data con main stats
  const combinedMainStats: MainStats = {
    ...mainStats,
    currentStreak: streakData?.currentStreak ?? 0,
    longestStreak: streakData?.longestStreak ?? 0,
  }

  // Separar artículos fuertes y débiles
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

// ============================================
// QUERIES INDIVIDUALES OPTIMIZADAS
// ============================================

async function getMainStats(db: ReturnType<typeof getDb>, userId: string): Promise<Omit<MainStats, 'currentStreak' | 'longestStreak'>> {
  // Una sola query con agregaciones SQL
  const result = await db
    .select({
      totalTests: sql<number>`COUNT(DISTINCT ${tests.id})::int`,
      totalQuestions: sql<number>`COUNT(${testQuestions.id})::int`,
      correctAnswers: sql<number>`SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::int`,
      totalTimeSeconds: sql<number>`COALESCE(SUM(${testQuestions.timeSpentSeconds}), 0)::int`,
      avgTimePerQuestion: sql<number>`COALESCE(AVG(${testQuestions.timeSpentSeconds}), 0)::float`,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(and(
      eq(tests.userId, userId),
      eq(tests.isCompleted, true)
    ))

  const stats = result[0] || {
    totalTests: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    totalTimeSeconds: 0,
    avgTimePerQuestion: 0,
  }

  // Obtener mejor puntuación
  const bestScoreResult = await db
    .select({
      bestScore: sql<number>`MAX(CASE WHEN ${tests.totalQuestions} > 0
        THEN (${tests.score}::float / ${tests.totalQuestions} * 100)
        ELSE 0 END)::int`,
    })
    .from(tests)
    .where(and(
      eq(tests.userId, userId),
      eq(tests.isCompleted, true)
    ))

  const accuracy = stats.totalQuestions > 0
    ? Math.round((stats.correctAnswers / stats.totalQuestions) * 100)
    : 0

  return {
    totalTests: stats.totalTests,
    totalQuestions: stats.totalQuestions,
    correctAnswers: stats.correctAnswers,
    accuracy,
    totalStudyTimeSeconds: stats.totalTimeSeconds,
    averageTimePerQuestion: Math.round(stats.avgTimePerQuestion),
    bestScore: bestScoreResult[0]?.bestScore || 0,
  }
}

async function getWeeklyProgress(
  db: ReturnType<typeof getDb>,
  userId: string,
  since: Date
): Promise<WeeklyProgress[]> {
  const result = await db
    .select({
      date: sql<string>`DATE(${testQuestions.createdAt} AT TIME ZONE 'Europe/Madrid')::text`,
      questions: sql<number>`COUNT(*)::int`,
      correct: sql<number>`SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::int`,
      studySeconds: sql<number>`COALESCE(SUM(${testQuestions.timeSpentSeconds}), 0)::int`,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(and(
      eq(tests.userId, userId),
      gte(testQuestions.createdAt, since.toISOString())
    ))
    .groupBy(sql`DATE(${testQuestions.createdAt} AT TIME ZONE 'Europe/Madrid')`)
    .orderBy(sql`DATE(${testQuestions.createdAt} AT TIME ZONE 'Europe/Madrid')`)

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  return result.map(row => {
    const date = new Date(row.date)
    return {
      day: dayNames[date.getDay()],
      date: row.date,
      questions: row.questions,
      correct: row.correct,
      accuracy: row.questions > 0 ? Math.round((row.correct / row.questions) * 100) : 0,
      studyMinutes: Math.round(row.studySeconds / 60),
    }
  })
}

async function getRecentTests(db: ReturnType<typeof getDb>, userId: string): Promise<RecentTest[]> {
  // Obtener positionType del usuario para resolver el título del tema
  const profileRow = await db
    .select({ targetOposicion: userProfiles.targetOposicion })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)
  const positionType = profileRow[0]?.targetOposicion?.replace(/-/g, '_') || 'auxiliar_administrativo_estado'

  // Query principal con LEFT JOIN a topics para obtener el título del tema
  const result = await db
    .select({
      id: tests.id,
      title: tests.title,
      temaNumber: tests.temaNumber,
      score: sql<number>`COALESCE(${tests.score}::int, 0)`,
      totalQuestions: sql<number>`COALESCE(${tests.totalQuestions}, 0)`,
      completedAt: tests.completedAt,
      timeSeconds: sql<number>`COALESCE(${tests.totalTimeSeconds}, 0)`,
      topicTitle: sql<string | null>`(
        SELECT t.title FROM topics t
        WHERE t.topic_number = ${tests.temaNumber}
          AND t.is_active = true
        ORDER BY CASE WHEN t.position_type = ${positionType} THEN 0 ELSE 1 END
        LIMIT 1
      )`,
      topicPositionType: sql<string | null>`(
        SELECT t.position_type FROM topics t
        WHERE t.topic_number = ${tests.temaNumber}
          AND t.is_active = true
        ORDER BY CASE WHEN t.position_type = ${positionType} THEN 0 ELSE 1 END
        LIMIT 1
      )`,
    })
    .from(tests)
    .where(and(
      eq(tests.userId, userId),
      eq(tests.isCompleted, true),
      isNotNull(tests.completedAt)
    ))
    .orderBy(desc(tests.completedAt))
    .limit(10)

  return result.map(row => ({
    id: row.id,
    title: row.title,
    temaNumber: row.temaNumber,
    topicTitle: row.topicTitle || null,
    topicPositionType: row.topicPositionType || null,
    score: row.score,
    totalQuestions: row.totalQuestions,
    accuracy: row.totalQuestions > 0 ? Math.round((row.score / row.totalQuestions) * 100) : 0,
    completedAt: row.completedAt || '',
    timeSeconds: row.timeSeconds,
  }))
}

async function getThemePerformance(db: ReturnType<typeof getDb>, userId: string): Promise<ThemePerformance[]> {
  // Obtener positionType del usuario para resolver títulos de temas
  const profileRow = await db
    .select({ targetOposicion: userProfiles.targetOposicion })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)
  const positionType = profileRow[0]?.targetOposicion?.replace(/-/g, '_') || 'auxiliar_administrativo_estado'

  // Leer de caché con JOIN a topics para obtener título y position_type reales
  try {
    const cacheResult = await db.execute(
      sql`SELECT
          c.topic_number, c.topic_title, c.total_questions, c.correct_answers,
          c.accuracy, c.average_time, c.last_practiced,
          (SELECT t.title FROM topics t
           WHERE t.topic_number = c.topic_number AND t.is_active = true
           ORDER BY CASE WHEN t.position_type = ${positionType} THEN 0 ELSE 1 END
           LIMIT 1) AS resolved_title,
          (SELECT t.position_type FROM topics t
           WHERE t.topic_number = c.topic_number AND t.is_active = true
           ORDER BY CASE WHEN t.position_type = ${positionType} THEN 0 ELSE 1 END
           LIMIT 1) AS topic_position_type
        FROM user_theme_performance_cache c
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

    // Si no hay caché, usar función en tiempo real (lento)
    console.warn('⚠️ Caché vacío en fallback, calculando en tiempo real...')
    const scopeResult = await db.execute(
      sql`SELECT * FROM get_theme_performance_by_scope(${userId}::uuid)`
    )

    if (scopeResult && Array.isArray(scopeResult) && scopeResult.length > 0) {
      const result = (scopeResult as any[]).map(row => ({
        temaNumber: row.topic_number,
        title: row.topic_title || null,
        totalQuestions: Number(row.total_questions) || 0,
        correctAnswers: Number(row.correct_answers) || 0,
        accuracy: Number(row.accuracy) || 0,
        averageTime: Math.round(Number(row.average_time) || 0),
        lastPracticed: row.last_practiced,
      }))
      // Write-through: guardar en caché para próximas peticiones
      writeThemePerformanceToCache(db, userId, result)
      return result
    }
  } catch (error) {
    console.warn('⚠️ Error cargando theme performance, usando fallback básico:', error)
  }

  // Fallback al método antiguo si la función no existe
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

async function getDifficultyBreakdown(db: ReturnType<typeof getDb>, userId: string): Promise<DifficultyBreakdown[]> {
  const result = await db
    .select({
      difficulty: testQuestions.difficulty,
      totalQuestions: sql<number>`COUNT(*)::int`,
      correctAnswers: sql<number>`SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::int`,
      averageTime: sql<number>`COALESCE(AVG(${testQuestions.timeSpentSeconds}), 0)::float`,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(and(
      eq(tests.userId, userId),
      isNotNull(testQuestions.difficulty)
    ))
    .groupBy(testQuestions.difficulty)

  return result
    .filter(row => row.difficulty !== null)
    .map(row => ({
      difficulty: row.difficulty!,
      totalQuestions: row.totalQuestions,
      correctAnswers: row.correctAnswers,
      accuracy: row.totalQuestions > 0 ? Math.round((row.correctAnswers / row.totalQuestions) * 100) : 0,
      averageTime: Math.round(row.averageTime),
    }))
}

async function getTimePatterns(db: ReturnType<typeof getDb>, userId: string): Promise<TimePatterns> {
  // Distribución por hora
  const hourlyResult = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${testQuestions.createdAt} AT TIME ZONE 'Europe/Madrid')::int`,
      questions: sql<number>`COUNT(*)::int`,
      correct: sql<number>`SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::int`,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(eq(tests.userId, userId))
    .groupBy(sql`EXTRACT(HOUR FROM ${testQuestions.createdAt} AT TIME ZONE 'Europe/Madrid')`)
    .orderBy(sql`EXTRACT(HOUR FROM ${testQuestions.createdAt} AT TIME ZONE 'Europe/Madrid')`)

  const hourlyDistribution = hourlyResult.map(row => ({
    hour: row.hour,
    questions: row.questions,
    accuracy: row.questions > 0 ? Math.round((row.correct / row.questions) * 100) : 0,
  }))

  // Identificar mejores y peores horas (mínimo 10 preguntas para ser significativo)
  const significantHours = hourlyDistribution.filter(h => h.questions >= 10)
  const sortedByAccuracy = [...significantHours].sort((a, b) => b.accuracy - a.accuracy)

  const bestHours = sortedByAccuracy.slice(0, 3).map(h => h.hour)
  const worstHours = sortedByAccuracy.slice(-3).map(h => h.hour)

  // Duración promedio de sesión (aproximada)
  const sessionResult = await db
    .select({
      avgMinutes: sql<number>`COALESCE(AVG(${tests.totalTimeSeconds}) / 60, 0)::float`,
    })
    .from(tests)
    .where(and(
      eq(tests.userId, userId),
      eq(tests.isCompleted, true)
    ))

  return {
    hourlyDistribution,
    bestHours,
    worstHours,
    averageSessionMinutes: Math.round(sessionResult[0]?.avgMinutes || 0),
  }
}

async function getArticleStats(db: ReturnType<typeof getDb>, userId: string): Promise<ArticlePerformance[]> {
  const result = await db
    .select({
      articleId: testQuestions.articleId,
      articleNumber: testQuestions.articleNumber,
      lawName: testQuestions.lawName,
      temaNumber: testQuestions.temaNumber,
      totalQuestions: sql<number>`COUNT(*)::int`,
      correctAnswers: sql<number>`SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::int`,
    })
    .from(testQuestions)
    .innerJoin(tests, eq(testQuestions.testId, tests.id))
    .where(and(
      eq(tests.userId, userId),
      isNotNull(testQuestions.articleNumber)
    ))
    .groupBy(testQuestions.articleId, testQuestions.articleNumber, testQuestions.lawName, testQuestions.temaNumber)
    .having(sql`COUNT(*) >= 2`) // Mínimo 2 preguntas para ser significativo
    .orderBy(sql`SUM(CASE WHEN ${testQuestions.isCorrect} THEN 1 ELSE 0 END)::float / COUNT(*)`)

  return result.map(row => ({
    articleId: row.articleId,
    articleNumber: row.articleNumber,
    lawName: row.lawName,
    temaNumber: row.temaNumber,
    totalQuestions: row.totalQuestions,
    correctAnswers: row.correctAnswers,
    accuracy: row.totalQuestions > 0 ? Math.round((row.correctAnswers / row.totalQuestions) * 100) : 0,
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

// ============================================
// OBTENER OPOSICIÓN DEL USUARIO
// ============================================

async function getUserOposicion(db: ReturnType<typeof getDb>, userId: string): Promise<UserOposicion | null> {
  try {
    // Obtener el perfil del usuario con su nombre, oposición objetivo y fecha de registro
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
    // Normalizar slug: convertir guiones bajos a guiones normales
    const targetOposicion = profile?.targetOposicion?.replace(/_/g, '-') || null

    // Calcular días desde registro (para predicciones de estudio)
    const daysSinceJoin = profile?.createdAt
      ? Math.max(1, Math.ceil((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24)))
      : 30 // Default 30 días si no hay fecha

    if (!targetOposicion) {
      // Devolver al menos el nombre del usuario y días desde registro
      return {
        userName: profile?.fullName || null,
        gender: (profile?.gender as 'male' | 'female' | 'other' | 'prefer_not_say' | null) || null,
        slug: null,
        nombre: null,
        tipoAcceso: null,
        examDate: null,
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

    // Buscar la oposición por slug
    const oposicionResult = await db
      .select({
        slug: oposiciones.slug,
        nombre: oposiciones.nombre,
        tipoAcceso: oposiciones.tipoAcceso,
        examDate: oposiciones.examDate,
        inscriptionDeadline: oposiciones.inscriptionDeadline,
        plazasLibres: oposiciones.plazasLibres,
        plazasPromocionInterna: oposiciones.plazasPromocionInterna,
        temasCount: oposiciones.temasCount,
        bloquesCount: oposiciones.bloquesCount,
        boePublicationDate: oposiciones.boePublicationDate,
        boeReference: oposiciones.boeReference,
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
      inscriptionDeadline: oposicion.inscriptionDeadline,
      plazas: (oposicion.plazasLibres || 0) + (oposicion.plazasPromocionInterna || 0), // Total
      plazasLibres: oposicion.plazasLibres || 0,
      plazasPromocionInterna: oposicion.plazasPromocionInterna || 0,
      temasCount: oposicion.temasCount,
      bloquesCount: oposicion.bloquesCount,
      boePublicationDate: oposicion.boePublicationDate,
      boeReference: oposicion.boeReference,
      daysSinceJoin,
    }
  } catch (error) {
    console.error('Error obteniendo oposición del usuario:', error)
    return null
  }
}

// ============================================
// SESIONES DE USUARIO
// ============================================

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
