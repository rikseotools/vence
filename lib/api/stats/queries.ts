// lib/api/stats/queries.ts - Queries optimizadas para estadísticas de usuario
import { getDb } from '@/db/client'
import { tests, testQuestions, userStreaks, userProfiles, oposiciones } from '@/db/schema'
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

// Cache simple en memoria (5 minutos)
const statsCache = new Map<string, { data: GetUserStatsResponse; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

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

    const db = getDb()
    const now = new Date()

    // 🚀 Ejecutar función SQL principal y getUserOposicion en paralelo
    const [sqlResult, userOposicion] = await Promise.all([
      db.execute(sql`SELECT get_user_stats_optimized(${userId}::uuid) as stats`),
      getUserOposicion(db, userId),
    ])

    const statsJson = (sqlResult as any)[0]?.stats

    if (!statsJson) {
      // Fallback a queries individuales si la función no existe
      console.warn('⚠️ Función get_user_stats_optimized no existe, usando fallback')
      return await getUserStatsFallback(userId)
    }

    // 🚀 Usar themePerformance de la función SQL como base.
    // Solo consultar alternativas si la función no devolvió datos de temas.
    let themePerformance: ThemePerformance[] = (statsJson.themePerformance || []).map((t: any) => ({
      temaNumber: t.temaNumber,
      totalQuestions: t.totalQuestions || 0,
      correctAnswers: t.correctAnswers || 0,
      accuracy: t.accuracy || 0,
      averageTime: t.averageTime || 0,
      lastPracticed: t.lastPracticed,
    }))

    // Solo buscar scope-based si la función SQL no devolvió temas
    if (themePerformance.length === 0) {
      try {
        // Intentar leer de la tabla caché
        const cacheResult = await db.execute(
          sql`SELECT topic_number, topic_title, total_questions, correct_answers,
              accuracy, average_time, last_practiced
              FROM user_theme_performance_cache
              WHERE user_id = ${userId}::uuid
              ORDER BY topic_number`
        )

        if (cacheResult && Array.isArray(cacheResult) && cacheResult.length > 0) {
          themePerformance = (cacheResult as any[]).map(row => ({
            temaNumber: row.topic_number,
            title: row.topic_title || null,
            totalQuestions: Number(row.total_questions) || 0,
            correctAnswers: Number(row.correct_answers) || 0,
            accuracy: Number(row.accuracy) || 0,
            averageTime: Math.round(Number(row.average_time) || 0),
            lastPracticed: row.last_practiced,
          }))
          console.log(`📊 Theme performance desde caché BD (${themePerformance.length} temas)`)
        } else {
          // Último recurso: calcular en tiempo real
          console.warn('⚠️ Caché vacío, calculando theme performance en tiempo real...')
          const scopeResult = await db.execute(
            sql`SELECT * FROM get_theme_performance_by_scope(${userId}::uuid)`
          )
          if (scopeResult && Array.isArray(scopeResult) && scopeResult.length > 0) {
            themePerformance = (scopeResult as any[]).map(row => ({
              temaNumber: row.topic_number,
              title: row.topic_title || null,
              totalQuestions: Number(row.total_questions) || 0,
              correctAnswers: Number(row.correct_answers) || 0,
              accuracy: Number(row.accuracy) || 0,
              averageTime: Math.round(Number(row.average_time) || 0),
              lastPracticed: row.last_practiced,
            }))
            await writeThemePerformanceToCache(db, userId, themePerformance)
          }
        }
      } catch (error) {
        console.warn('⚠️ Error cargando theme performance:', error)
      }
    }

    // 🚀 Usar weakArticles/strongArticles de la función SQL directamente
    // (evita una query separada de getArticleStats que duplicaba el trabajo)
    const weakArticles: ArticlePerformance[] = (statsJson.weakArticles || []).map((a: any) => ({
      articleId: a.articleId || null,
      articleNumber: a.articleNumber || null,
      lawName: a.lawName || null,
      temaNumber: a.temaNumber || null,
      totalQuestions: a.totalQuestions || 0,
      correctAnswers: a.correctAnswers || 0,
      accuracy: a.accuracy || 0,
    }))
    const strongArticles: ArticlePerformance[] = (statsJson.strongArticles || []).map((a: any) => ({
      articleId: a.articleId || null,
      articleNumber: a.articleNumber || null,
      lawName: a.lawName || null,
      temaNumber: a.temaNumber || null,
      totalQuestions: a.totalQuestions || 0,
      correctAnswers: a.correctAnswers || 0,
      accuracy: a.accuracy || 0,
    }))

    // Parsear y formatear la respuesta
    const response: GetUserStatsResponse = {
      success: true,
      stats: {
        main: {
          totalTests: statsJson.main.totalTests || 0,
          totalQuestions: statsJson.main.totalQuestions || 0,
          correctAnswers: statsJson.main.correctAnswers || 0,
          accuracy: statsJson.main.accuracy || 0,
          totalStudyTimeSeconds: statsJson.main.totalStudyTimeSeconds || 0,
          averageTimePerQuestion: statsJson.main.averageTimePerQuestion || 0,
          bestScore: statsJson.main.bestScore || 0,
          currentStreak: statsJson.main.currentStreak || 0,
          longestStreak: statsJson.main.longestStreak || 0,
        },
        weeklyProgress: (statsJson.weeklyProgress || []).map((d: any) => ({
          day: getDayName(new Date(d.date)),
          date: d.date,
          questions: d.questions || 0,
          correct: d.correct || 0,
          accuracy: d.accuracy || 0,
          studyMinutes: d.studyMinutes || 0,
        })),
        recentTests: (statsJson.recentTests || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          temaNumber: t.temaNumber,
          score: t.score || 0,
          totalQuestions: t.totalQuestions || 0,
          accuracy: t.accuracy || 0,
          completedAt: t.completedAt || '',
          timeSeconds: t.timeSeconds || 0,
        })),
        themePerformance,
        difficultyBreakdown: (statsJson.difficultyBreakdown || []).map((d: any) => ({
          difficulty: d.difficulty,
          totalQuestions: d.totalQuestions || 0,
          correctAnswers: d.correctAnswers || 0,
          accuracy: d.accuracy || 0,
          averageTime: d.averageTime || 0,
        })),
        timePatterns: {
          hourlyDistribution: (statsJson.timePatterns?.hourlyDistribution || []).map((h: any) => ({
            hour: h.hour,
            questions: h.questions || 0,
            accuracy: h.accuracy || 0,
          })),
          bestHours: getBestHours(statsJson.timePatterns?.hourlyDistribution || []),
          worstHours: getWorstHours(statsJson.timePatterns?.hourlyDistribution || []),
          averageSessionMinutes: statsJson.timePatterns?.averageSessionMinutes || 0,
        },
        weakArticles,
        strongArticles,
        userOposicion: userOposicion ?? undefined,
      },
      generatedAt: now.toISOString(),
    }

    // Guardar en cache
    statsCache.set(userId, { data: response, timestamp: Date.now() })

    return response
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error)
    // Intentar fallback
    try {
      return await getUserStatsFallback(userId)
    } catch (fallbackError) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      }
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

// Fallback usando queries individuales (más lento pero funciona sin la función SQL)
async function getUserStatsFallback(userId: string): Promise<GetUserStatsResponse> {
  const db = getDb()
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

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
  ] = await Promise.all([
    getMainStats(db, userId),
    getWeeklyProgress(db, userId, sevenDaysAgo),
    getRecentTests(db, userId),
    getThemePerformance(db, userId),
    getDifficultyBreakdown(db, userId),
    getTimePatterns(db, userId),
    getArticleStats(db, userId),
    getStreakData(db, userId),
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
  const result = await db
    .select({
      id: tests.id,
      title: tests.title,
      temaNumber: tests.temaNumber,
      score: sql<number>`COALESCE(${tests.score}::int, 0)`,
      totalQuestions: sql<number>`COALESCE(${tests.totalQuestions}, 0)`,
      completedAt: tests.completedAt,
      timeSeconds: sql<number>`COALESCE(${tests.totalTimeSeconds}, 0)`,
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
    score: row.score,
    totalQuestions: row.totalQuestions,
    accuracy: row.totalQuestions > 0 ? Math.round((row.score / row.totalQuestions) * 100) : 0,
    completedAt: row.completedAt || '',
    timeSeconds: row.timeSeconds,
  }))
}

async function getThemePerformance(db: ReturnType<typeof getDb>, userId: string): Promise<ThemePerformance[]> {
  // 🚀 OPTIMIZADO: Leer de caché en lugar de función lenta
  try {
    // Intentar leer de la tabla caché primero
    const cacheResult = await db.execute(
      sql`SELECT topic_number, topic_title, total_questions, correct_answers,
          accuracy, average_time, last_practiced
          FROM user_theme_performance_cache
          WHERE user_id = ${userId}::uuid
          ORDER BY topic_number`
    )

    if (cacheResult && Array.isArray(cacheResult) && cacheResult.length > 0) {
      return (cacheResult as any[]).map(row => ({
        temaNumber: row.topic_number,
        title: row.topic_title || null,
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
// INVALIDAR CACHE
// ============================================

export function invalidateStatsCache(userId: string): void {
  statsCache.delete(userId)
}

export function clearAllStatsCache(): void {
  statsCache.clear()
}
