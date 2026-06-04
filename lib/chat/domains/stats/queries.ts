// lib/chat/domains/stats/queries.ts
// Queries para estadísticas de exámenes y usuarios

// Lecturas por self-hosted PgBouncer (max:8, sano), no Supavisor max:1 → 504.
import { getPoolerDb } from '@/db/client'
import { questions, articles, laws, userQuestionHistoryV2 } from '@/db/schema'
import { eq, and, gte, lt, isNotNull } from 'drizzle-orm'
import { logger } from '../../shared/logger'
import type { ExamStatsResult, UserStatsResult, ArticleCount, ArticleStats } from './schemas'

// ============================================
// ESTADÍSTICAS DE EXÁMENES OFICIALES
// ============================================

/**
 * Obtiene estadísticas de artículos más preguntados en exámenes oficiales
 */
export async function getExamStats(
  lawShortName: string | null = null,
  limit: number = 15,
  examPosition: string | null = null
): Promise<ExamStatsResult | null> {
  try {
    // Preguntas de exámenes oficiales con join questions -> articles -> laws.
    // El innerJoin a laws reproduce el `laws!inner` del embed supabase anterior.
    const conditions = [
      eq(questions.isActive, true),
      eq(questions.isOfficialExam, true),
      isNotNull(questions.primaryArticleId),
    ]
    if (examPosition) {
      conditions.push(eq(questions.examPosition, examPosition))
    }

    const db = getPoolerDb()
    const allQuestions = await db
      .select({
        id: questions.id,
        exam_position: questions.examPosition,
        article_number: articles.articleNumber,
        law_short_name: laws.shortName,
        law_name: laws.name,
      })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(...conditions))

    if (!allQuestions.length) {
      logger.debug('No se encontraron preguntas de exámenes oficiales', { domain: 'stats' })
      return null
    }

    // Filtrar por ley si se especifica
    let filteredQuestions = allQuestions
    if (lawShortName) {
      filteredQuestions = allQuestions.filter((q) => q.law_short_name === lawShortName)
    }

    if (filteredQuestions.length === 0) {
      logger.debug('No hay preguntas para el filtro especificado', { domain: 'stats' })
      return null
    }

    // Contar apariciones por artículo, incluyendo desglose por oposición
    const articleCounts: Record<string, ArticleCount> = {}
    filteredQuestions.forEach((q) => {
      const law = q.law_short_name || q.law_name || 'Ley'
      const artNum = q.article_number
      if (!artNum) return

      const key = `${law} Art. ${artNum}`
      if (!articleCounts[key]) {
        articleCounts[key] = {
          law,
          article: String(artNum),
          count: 0,
          byPosition: {},
        }
      }
      articleCounts[key].count++

      // Registrar por oposición
      const pos = q.exam_position || 'sin_especificar'
      if (!articleCounts[key].byPosition[pos]) {
        articleCounts[key].byPosition[pos] = 0
      }
      articleCounts[key].byPosition[pos]++
    })

    // Ordenar por frecuencia y devolver top
    const sorted = Object.values(articleCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    logger.info('Exam stats calculated', {
      domain: 'stats',
      totalQuestions: filteredQuestions.length,
      topArticlesCount: sorted.length,
    })

    return {
      totalOfficialQuestions: filteredQuestions.length,
      topArticles: sorted,
      lawFilter: lawShortName,
      positionFilter: examPosition,
    }
  } catch (err) {
    logger.error('Error obteniendo estadísticas de exámenes', err, { domain: 'stats' })
    return null
  }
}

// ============================================
// ESTADÍSTICAS DE USUARIO
// ============================================

/**
 * Obtiene estadísticas de una semana específica
 */
async function getWeekStats(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  totalQuestions: number
  correctAnswers: number
  accuracy: number
} | null> {
  try {
    // Obtener respuestas de la semana
    // UQH Fase 3: migrado de user_question_history (v1, congelada desde
    // cutover outbox 2026-05-30) a v2 que escribe el handler Fargate.
    const db = getPoolerDb()
    const data = await db
      .select({
        total_attempts: userQuestionHistoryV2.totalAttempts,
        correct_attempts: userQuestionHistoryV2.correctAttempts,
      })
      .from(userQuestionHistoryV2)
      .where(and(
        eq(userQuestionHistoryV2.userId, userId),
        gte(userQuestionHistoryV2.lastAttemptAt, startDate.toISOString()),
        lt(userQuestionHistoryV2.lastAttemptAt, endDate.toISOString()),
      ))

    const totalQuestions = data.reduce((sum, record) => sum + record.total_attempts, 0)
    const correctAnswers = data.reduce((sum, record) => sum + record.correct_attempts, 0)
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0

    return { totalQuestions, correctAnswers, accuracy }
  } catch (err) {
    logger.error('Error obteniendo stats de semana', err, { domain: 'stats' })
    return { totalQuestions: 0, correctAnswers: 0, accuracy: 0 }
  }
}

/**
 * Obtiene comparación de estadísticas entre esta semana y la semana pasada
 */
export async function getWeeklyComparison(userId: string): Promise<{
  thisWeek: { totalQuestions: number; correctAnswers: number; accuracy: number }
  lastWeek: { totalQuestions: number; correctAnswers: number; accuracy: number }
  improvement: { questions: number; accuracy: number }
} | null> {
  if (!userId) return null

  // Calcular fechas en hora Madrid (importante en Vercel que corre en UTC)
  const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))

  // Esta semana: desde el lunes 00:00 hora Madrid
  const thisWeekStart = new Date(nowMadrid)
  const day = thisWeekStart.getDay()
  const diff = day === 0 ? 6 : day - 1 // Lunes = 0
  thisWeekStart.setDate(thisWeekStart.getDate() - diff)
  thisWeekStart.setHours(0, 0, 0, 0)

  // Fin de esta semana: ahora
  const thisWeekEnd = new Date(nowMadrid)

  // Semana pasada: 7 días antes del lunes
  const lastWeekStart = new Date(thisWeekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  const lastWeekEnd = new Date(thisWeekStart)

  // Obtener stats de ambas semanas
  const thisWeek = await getWeekStats(userId, thisWeekStart, thisWeekEnd)
  const lastWeek = await getWeekStats(userId, lastWeekStart, lastWeekEnd)

  if (!thisWeek || !lastWeek) return null

  // Calcular mejoras
  const questionsDiff = thisWeek.totalQuestions - lastWeek.totalQuestions
  const accuracyDiff = thisWeek.accuracy - lastWeek.accuracy

  return {
    thisWeek,
    lastWeek,
    improvement: {
      questions: questionsDiff,
      accuracy: accuracyDiff
    }
  }
}

/**
 * Obtiene estadísticas de fallos y áreas débiles del usuario
 * Usa la RPC get_user_statistics_complete para evitar queries lentas
 */
export async function getUserStats(
  userId: string,
  lawShortName: string | null = null,
  limit: number = 10,
  _fromDate: Date | null = null // No usado por la RPC actual, pero mantenemos la firma
): Promise<UserStatsResult | null> {
  if (!userId) return null

  try {
    // Antes: supabase.rpc('get_user_statistics_complete') → 77s para heavy users (8 scans sobre test_questions).
    // Ahora: 2 queries ligeras (~100ms total):
    //   1. user_stats_summary (PK lookup, <1ms)
    //   2. user_question_history + JOINs con LIMIT (99ms)

    const { getDb } = await import('@/db/client')
    const { sql } = await import('drizzle-orm')
    const db = getDb()

    // Query 1: Stats básicas desde tabla pre-computada
    const summaryResult = await db.execute(
      sql`SELECT total_questions, correct_answers FROM user_stats_summary WHERE user_id = ${userId}`
    )
    const summary = (summaryResult as any)?.[0]
    const totalAnswers = Number(summary?.total_questions ?? 0)
    const totalCorrect = Number(summary?.correct_answers ?? 0)
    const overallAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 1000) / 10 : 0

    // Query 2: Peores artículos desde user_question_history (pre-agregado por pregunta)
    const lawFilter = lawShortName
      ? sql`AND l.short_name ILIKE ${'%' + lawShortName + '%'}`
      : sql``

    // UQH Fase 3: migrado a v2 (cutover outbox 2026-05-30 dejó v1 congelada).
    const articleResult = await db.execute(sql`
      SELECT a.article_number, l.short_name as law_name,
             uqh.total_attempts as total, uqh.correct_attempts as correct,
             ROUND(uqh.success_rate::numeric * 100, 1) as accuracy
      FROM user_question_history_v2 uqh
      JOIN questions q ON q.id = uqh.question_id
      JOIN articles a ON q.primary_article_id = a.id
      JOIN laws l ON a.law_id = l.id
      WHERE uqh.user_id = ${userId}
        AND uqh.total_attempts >= 2
        AND a.article_number IS NOT NULL
        ${lawFilter}
      ORDER BY uqh.success_rate ASC
      LIMIT ${limit * 2}
    `)

    const articlePerf = (articleResult as any[]) || []

    if (articlePerf.length === 0 && totalAnswers === 0) {
      logger.debug('No hay estadísticas para este usuario', { domain: 'stats' })
      return null
    }

    // Transformar al formato esperado
    const articleStats: ArticleStats[] = articlePerf.map((a: any) => {
      const article = a.article_number
      const articleLabel = article === '0' || article === 0 ? 'Estructura' : `Art. ${article}`
      const lawShort = a.law_name?.split(' de ')[0] || a.law_name?.substring(0, 20) || 'Ley'
      const total = Number(a.total)
      const correct = Number(a.correct)

      return {
        law: lawShort,
        article: articleLabel,
        total,
        correct,
        failed: total - correct,
        accuracy: Number(a.accuracy),
      }
    })

    // Artículos más fallados (ordenados por número de fallos)
    const mostFailed = [...articleStats]
      .filter(s => s.failed > 0)
      .sort((a, b) => b.failed - a.failed)
      .slice(0, limit)

    // Artículos con peor porcentaje
    const worstAccuracy = [...articleStats]
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, limit)

    logger.info('User stats calculated via summary + history', {
      domain: 'stats',
      totalAnswers,
      overallAccuracy,
      mostFailedCount: mostFailed.length,
    })

    return {
      totalAnswers,
      totalCorrect,
      totalFailed: totalAnswers - totalCorrect,
      overallAccuracy,
      mostFailed,
      worstAccuracy,
      lawFilter: lawShortName,
    }
  } catch (err) {
    logger.error('Error obteniendo estadísticas del usuario', err, { domain: 'stats' })
    return null
  }
}
