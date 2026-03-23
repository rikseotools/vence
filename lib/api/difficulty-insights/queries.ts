// lib/api/difficulty-insights/queries.ts
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type {
  GetDifficultyInsightsResponse,
  DifficultyMetrics,
  PersonalBreakdown,
  QuestionResult,
  ProgressTrends,
  Recommendation,
} from './schemas'

export async function getDifficultyInsights(userId: string): Promise<GetDifficultyInsightsResponse> {
  try {
    const db = getDb()

    // Ejecutar las 6 queries en paralelo
    const [
      metricsResult,
      personalBreakdownResult,
      strugglingResult,
      masteredResult,
      trendsResult,
      recommendationsResult,
    ] = await Promise.all([
      getMetrics(db, userId),
      getPersonalBreakdown(db, userId),
      getStrugglingQuestions(db, userId, 5),
      getMasteredQuestions(db, userId, 5),
      getProgressTrends(db, userId),
      getRecommendations(db, userId),
    ])

    // Enriquecer preguntas con datos de ley/artículo para hacerlas accionables
    const allQuestionIds = [
      ...strugglingResult.map(q => q.questionId),
      ...masteredResult.map(q => q.questionId),
    ]
    const enrichment = allQuestionIds.length > 0
      ? await getQuestionEnrichment(db, allQuestionIds)
      : new Map<string, { lawSlug: string; lawName: string; articleNumber: string }>()

    const enrich = (questions: QuestionResult[]) =>
      questions.map(q => ({
        ...q,
        ...(enrichment.get(q.questionId) || {}),
      }))

    return {
      success: true,
      data: {
        metrics: metricsResult,
        personalBreakdown: personalBreakdownResult,
        strugglingQuestions: enrich(strugglingResult),
        masteredQuestions: enrich(masteredResult),
        progressTrends: trendsResult,
        recommendations: recommendationsResult,
      },
    }
  } catch (error) {
    console.error('Error obteniendo difficulty insights:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// Métricas globales del usuario
async function getMetrics(db: ReturnType<typeof getDb>, userId: string): Promise<DifficultyMetrics> {
  try {
    const result = await db.execute(
      sql`SELECT * FROM get_user_difficulty_metrics(${userId}::uuid)`
    )
    const row = (result as Record<string, unknown>[])[0]
    if (!row) return emptyMetrics()

    return {
      totalQuestionsAttempted: Number(row.total_questions_attempted) || 0,
      questionsMastered: Number(row.questions_mastered) || 0,
      questionsStruggling: Number(row.questions_struggling) || 0,
      avgPersonalDifficulty: Number(row.avg_personal_difficulty) || 0,
      accuracyTrend: parseTrend(row.accuracy_trend as string),
    }
  } catch (error) {
    console.warn('⚠️ RPC get_user_difficulty_metrics error, using fallback:', error)
    return await getMetricsFallback(db, userId)
  }
}

// Fallback si la RPC no existe: calcular desde test_questions
async function getMetricsFallback(db: ReturnType<typeof getDb>, userId: string): Promise<DifficultyMetrics> {
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT tq.question_id)::int AS total_questions_attempted,
      COUNT(DISTINCT tq.question_id) FILTER (
        WHERE tq.question_id IN (
          SELECT tq2.question_id FROM test_questions tq2
          INNER JOIN tests t2 ON tq2.test_id = t2.id
          WHERE t2.user_id = ${userId}::uuid
          GROUP BY tq2.question_id
          HAVING AVG(CASE WHEN tq2.is_correct THEN 1.0 ELSE 0.0 END) >= 0.8
        )
      )::int AS questions_mastered,
      COUNT(DISTINCT tq.question_id) FILTER (
        WHERE tq.question_id IN (
          SELECT tq2.question_id FROM test_questions tq2
          INNER JOIN tests t2 ON tq2.test_id = t2.id
          WHERE t2.user_id = ${userId}::uuid
          GROUP BY tq2.question_id
          HAVING AVG(CASE WHEN tq2.is_correct THEN 1.0 ELSE 0.0 END) < 0.4
        )
      )::int AS questions_struggling
    FROM test_questions tq
    INNER JOIN tests t ON tq.test_id = t.id
    WHERE t.user_id = ${userId}::uuid
  `)

  const row = (result as Record<string, unknown>[])[0]
  return {
    totalQuestionsAttempted: Number(row?.total_questions_attempted) || 0,
    questionsMastered: Number(row?.questions_mastered) || 0,
    questionsStruggling: Number(row?.questions_struggling) || 0,
    avgPersonalDifficulty: 0,
    accuracyTrend: 'stable',
  }
}

// Preguntas con peor rendimiento
async function getStrugglingQuestions(db: ReturnType<typeof getDb>, userId: string, limit: number): Promise<QuestionResult[]> {
  try {
    const result = await db.execute(
      sql`SELECT * FROM get_struggling_questions(${userId}::uuid, ${limit})`
    )
    return mapQuestionResults(result as Record<string, unknown>[])
  } catch {
    return await getStrugglingFallback(db, userId, limit)
  }
}

async function getStrugglingFallback(db: ReturnType<typeof getDb>, userId: string, limit: number): Promise<QuestionResult[]> {
  const result = await db.execute(sql`
    SELECT
      tq.question_id,
      q.question_text,
      COUNT(*)::int AS total_attempts,
      ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) * 100, 1) AS success_rate,
      ROUND((1 - AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END)) * 100, 1) AS personal_difficulty
    FROM test_questions tq
    INNER JOIN tests t ON tq.test_id = t.id
    INNER JOIN questions q ON tq.question_id = q.id
    WHERE t.user_id = ${userId}::uuid
    GROUP BY tq.question_id, q.question_text
    HAVING COUNT(*) >= 2 AND AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) < 0.4
    ORDER BY AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) ASC
    LIMIT ${limit}
  `)
  return mapQuestionResults(result as Record<string, unknown>[])
}

// Preguntas dominadas
async function getMasteredQuestions(db: ReturnType<typeof getDb>, userId: string, limit: number): Promise<QuestionResult[]> {
  try {
    const result = await db.execute(
      sql`SELECT * FROM get_mastered_questions(${userId}::uuid, ${limit})`
    )
    return mapQuestionResults(result as Record<string, unknown>[])
  } catch {
    return await getMasteredFallback(db, userId, limit)
  }
}

async function getMasteredFallback(db: ReturnType<typeof getDb>, userId: string, limit: number): Promise<QuestionResult[]> {
  const result = await db.execute(sql`
    SELECT
      tq.question_id,
      q.question_text,
      COUNT(*)::int AS total_attempts,
      ROUND(AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) * 100, 1) AS success_rate,
      ROUND((1 - AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END)) * 100, 1) AS personal_difficulty
    FROM test_questions tq
    INNER JOIN tests t ON tq.test_id = t.id
    INNER JOIN questions q ON tq.question_id = q.id
    WHERE t.user_id = ${userId}::uuid
    GROUP BY tq.question_id, q.question_text
    HAVING COUNT(*) >= 2 AND AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) >= 0.8
    ORDER BY AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) DESC
    LIMIT ${limit}
  `)
  return mapQuestionResults(result as Record<string, unknown>[])
}

// Tendencias de progreso
async function getProgressTrends(db: ReturnType<typeof getDb>, userId: string): Promise<ProgressTrends> {
  try {
    const result = await db.execute(
      sql`SELECT * FROM get_user_progress_trends(${userId}::uuid)`
    )
    const row = (result as Record<string, unknown>[])[0]
    return {
      improving: Number(row?.improving) || 0,
      declining: Number(row?.declining) || 0,
      stable: Number(row?.stable) || 0,
      total: Number(row?.total) || 0,
    }
  } catch {
    return { improving: 0, declining: 0, stable: 0, total: 0 }
  }
}

// Recomendaciones personalizadas
async function getRecommendations(db: ReturnType<typeof getDb>, userId: string): Promise<Recommendation[]> {
  try {
    const result = await db.execute(
      sql`SELECT * FROM get_personalized_recommendations(${userId}::uuid)`
    )
    return (result as Record<string, unknown>[]).map(row => ({
      priority: parsePriority(row.priority as string),
      title: String(row.title || ''),
      description: String(row.description || '').trim(),
      actionType: String(row.action_type || ''),
    }))
  } catch {
    return []
  }
}

// Desglose por dificultad personal (clasificación por success rate del usuario)
async function getPersonalBreakdown(db: ReturnType<typeof getDb>, userId: string): Promise<PersonalBreakdown> {
  try {
    const result = await db.execute(sql`
      WITH question_stats AS (
        SELECT
          tq.question_id,
          AVG(CASE WHEN tq.is_correct THEN 1.0 ELSE 0.0 END) AS success_rate
        FROM test_questions tq
        INNER JOIN tests t ON tq.test_id = t.id
        WHERE t.user_id = ${userId}::uuid
        GROUP BY tq.question_id
        HAVING COUNT(*) >= 2
      )
      SELECT
        COUNT(*) FILTER (WHERE success_rate >= 0.8)::int AS easy,
        COUNT(*) FILTER (WHERE success_rate >= 0.6 AND success_rate < 0.8)::int AS medium,
        COUNT(*) FILTER (WHERE success_rate >= 0.4 AND success_rate < 0.6)::int AS hard,
        COUNT(*) FILTER (WHERE success_rate < 0.4)::int AS extreme,
        COUNT(*)::int AS total
      FROM question_stats
    `)
    const row = (result as Record<string, unknown>[])[0]
    return {
      easy: Number(row?.easy) || 0,
      medium: Number(row?.medium) || 0,
      hard: Number(row?.hard) || 0,
      extreme: Number(row?.extreme) || 0,
      total: Number(row?.total) || 0,
    }
  } catch (error) {
    console.warn('⚠️ Error calculando personal breakdown:', error)
    return { easy: 0, medium: 0, hard: 0, extreme: 0, total: 0 }
  }
}

// Enriquecer preguntas con ley y artículo (una sola query batch)
async function getQuestionEnrichment(
  db: ReturnType<typeof getDb>,
  questionIds: string[]
): Promise<Map<string, { lawSlug: string; lawName: string; articleNumber: string }>> {
  const map = new Map<string, { lawSlug: string; lawName: string; articleNumber: string }>()
  if (questionIds.length === 0) return map

  try {
    const result = await db.execute(sql`
      SELECT q.id AS question_id, a.article_number, l.slug AS law_slug, l.short_name AS law_name
      FROM questions q
      INNER JOIN articles a ON q.primary_article_id = a.id
      INNER JOIN laws l ON a.law_id = l.id
      WHERE q.id = ANY(${questionIds}::uuid[])
    `)

    for (const row of result as Record<string, unknown>[]) {
      map.set(String(row.question_id), {
        lawSlug: String(row.law_slug || ''),
        lawName: String(row.law_name || ''),
        articleNumber: String(row.article_number || ''),
      })
    }
  } catch (error) {
    console.warn('⚠️ Error enriqueciendo preguntas:', error)
  }

  return map
}

// Helpers
function emptyMetrics(): DifficultyMetrics {
  return {
    totalQuestionsAttempted: 0,
    questionsMastered: 0,
    questionsStruggling: 0,
    avgPersonalDifficulty: 0,
    accuracyTrend: 'stable',
  }
}

function mapQuestionResults(rows: Record<string, unknown>[]): QuestionResult[] {
  return (rows || []).map(row => ({
    questionId: String(row.question_id || ''),
    questionText: String(row.question_text || ''),
    totalAttempts: Number(row.total_attempts) || 0,
    successRate: (Number(row.success_rate) || 0) / 100, // Normalizar a 0-1
    personalDifficulty: Number(row.personal_difficulty) || 0,
    trend: String(row.trend || 'stable'),
  }))
}

function parseTrend(value: string): 'improving' | 'declining' | 'stable' {
  if (value === 'improving' || value === 'declining') return value
  return 'stable'
}

function parsePriority(value: string): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}
