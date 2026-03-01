// lib/api/admin-analytics/queries.ts - Queries SQL para analytics de preguntas problemáticas
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import type { AnalyticsResponse, ProblematicQuestion, FrequentlyFailedQuestion, ReviewHistoryItem, FullQuestionData } from './schemas'

/**
 * Preguntas que causan alto abandono.
 *
 * Agrupa test_questions cuyos tests NO están completados (is_completed=false),
 * filtra >= 2 apariciones y >= 40% abandono, excluye resolved en
 * problematic_questions_tracking, enriquece con question data + review history.
 */
async function getProblematicQuestions(limit = 15): Promise<ProblematicQuestion[]> {
  const db = getDb()

  const statsRows = await db.execute(sql`
    WITH resolved AS (
      SELECT DISTINCT question_id FROM problematic_questions_tracking WHERE status = 'resolved'
    )
    SELECT
      tq.question_id,
      SUBSTRING(tq.question_text FROM 1 FOR 100) AS question_text,
      COALESCE(tq.law_name, 'Sin ley') AS law,
      COALESCE(tq.article_number, 'Sin artículo') AS article,
      COUNT(*)::int AS total_appearances,
      COUNT(*) FILTER (WHERE t.is_completed = false)::int AS abandoned_at,
      ROUND(COUNT(*) FILTER (WHERE t.is_completed = false)::numeric / NULLIF(COUNT(*), 0) * 100)::int AS abandonment_rate,
      ROUND(AVG(tq.question_order))::int AS avg_question_order,
      COUNT(DISTINCT tq.test_id)::int AS unique_tests_count,
      COUNT(DISTINCT t.user_id) FILTER (WHERE t.is_completed = false)::int AS unique_users_abandoned_count
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    JOIN questions q ON q.id = tq.question_id AND q.is_active = true
    WHERE tq.question_id IS NOT NULL
      AND tq.question_id NOT IN (SELECT question_id FROM resolved WHERE question_id IS NOT NULL)
    GROUP BY tq.question_id, SUBSTRING(tq.question_text FROM 1 FOR 100), tq.law_name, tq.article_number
    HAVING COUNT(*) >= 2
      AND COUNT(*) FILTER (WHERE t.is_completed = false) >= 2
      AND ROUND(COUNT(*) FILTER (WHERE t.is_completed = false)::numeric / NULLIF(COUNT(*), 0) * 100) >= 40
    ORDER BY COUNT(DISTINCT t.user_id) FILTER (WHERE t.is_completed = false) DESC
    LIMIT ${limit}
  `) as unknown as Array<{
    question_id: string
    question_text: string
    law: string
    article: string
    total_appearances: number
    abandoned_at: number
    abandonment_rate: number
    avg_question_order: number
    unique_tests_count: number
    unique_users_abandoned_count: number
  }>

  if (!statsRows.length) return []

  const questionIds = statsRows.map(r => r.question_id)

  const [fullDataRows, reviewRows] = await Promise.all([
    getFullQuestionData(questionIds),
    getReviewHistory(questionIds),
  ])

  const fullDataMap = new Map(fullDataRows.map(r => [r.id, r]))
  const reviewMap = groupReviewsByQuestionId(reviewRows)

  return statsRows.map(row => ({
    questionId: row.question_id,
    questionText: row.question_text || 'Texto no disponible',
    law: row.law,
    article: row.article,
    totalAppearances: row.total_appearances,
    abandonedAt: row.abandoned_at,
    abandonmentRate: row.abandonment_rate,
    avgQuestionOrder: row.avg_question_order,
    uniqueTestsCount: row.unique_tests_count,
    uniqueUsersAbandonedCount: row.unique_users_abandoned_count,
    fullData: mapFullData(fullDataMap.get(row.question_id)),
    reviewHistory: reviewMap.get(row.question_id) || [],
  }))
}

/**
 * Preguntas falladas frecuentemente.
 *
 * Agrupa test_questions por question_id, cuenta fallos/aciertos y usuarios
 * distintos, filtra >= 3 intentos, >= 2 usuarios fallaron, >= 60% error.
 * Excluye resolved y enriquece igual que arriba.
 */
async function getFrequentlyFailedQuestions(limit = 15): Promise<FrequentlyFailedQuestion[]> {
  const db = getDb()

  const statsRows = await db.execute(sql`
    WITH resolved AS (
      SELECT DISTINCT question_id FROM problematic_questions_tracking WHERE status = 'resolved'
    )
    SELECT
      tq.question_id,
      SUBSTRING(tq.question_text FROM 1 FOR 100) AS question_text,
      COALESCE(tq.law_name, 'Sin ley') AS law,
      COALESCE(tq.article_number, 'Sin artículo') AS article,
      COUNT(*)::int AS total_attempts,
      COUNT(*) FILTER (WHERE tq.is_correct = false)::int AS incorrect_attempts,
      COUNT(*) FILTER (WHERE tq.is_correct = true)::int AS correct_attempts,
      ROUND(COUNT(*) FILTER (WHERE tq.is_correct = false)::numeric / NULLIF(COUNT(*), 0) * 100)::int AS failure_rate,
      COALESCE(ROUND(AVG(tq.time_spent_seconds))::int, 0) AS avg_time_spent,
      COUNT(DISTINCT t.user_id) FILTER (WHERE tq.is_correct = false)::int AS unique_users_wrong_count,
      COUNT(DISTINCT t.user_id) FILTER (WHERE tq.is_correct = true)::int AS unique_users_correct_count,
      COUNT(DISTINCT tq.test_id)::int AS unique_tests_count,
      ROUND(COUNT(*) FILTER (WHERE tq.confidence_level IN ('unsure', 'guessing'))::numeric / NULLIF(COUNT(*), 0) * 100)::int AS low_confidence_rate
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    JOIN questions q ON q.id = tq.question_id AND q.is_active = true
    WHERE tq.question_id IS NOT NULL
      AND tq.question_id NOT IN (SELECT question_id FROM resolved WHERE question_id IS NOT NULL)
    GROUP BY tq.question_id, SUBSTRING(tq.question_text FROM 1 FOR 100), tq.law_name, tq.article_number
    HAVING COUNT(*) >= 3
      AND COUNT(DISTINCT t.user_id) FILTER (WHERE tq.is_correct = false) >= 2
      AND ROUND(COUNT(*) FILTER (WHERE tq.is_correct = false)::numeric / NULLIF(COUNT(*), 0) * 100) >= 60
    ORDER BY COUNT(DISTINCT t.user_id) FILTER (WHERE tq.is_correct = false) DESC
    LIMIT ${limit}
  `) as unknown as Array<{
    question_id: string
    question_text: string
    law: string
    article: string
    total_attempts: number
    incorrect_attempts: number
    correct_attempts: number
    failure_rate: number
    avg_time_spent: number
    unique_users_wrong_count: number
    unique_users_correct_count: number
    unique_tests_count: number
    low_confidence_rate: number
  }>

  if (!statsRows.length) return []

  const questionIds = statsRows.map(r => r.question_id)

  const [fullDataRows, reviewRows] = await Promise.all([
    getFullQuestionData(questionIds),
    getReviewHistory(questionIds),
  ])

  const fullDataMap = new Map(fullDataRows.map(r => [r.id, r]))
  const reviewMap = groupReviewsByQuestionId(reviewRows)

  return statsRows.map(row => ({
    questionId: row.question_id,
    questionText: row.question_text || 'Texto no disponible',
    law: row.law,
    article: row.article,
    totalAttempts: row.total_attempts,
    incorrectAttempts: row.incorrect_attempts,
    correctAttempts: row.correct_attempts,
    failureRate: row.failure_rate,
    avgTimeSpent: row.avg_time_spent,
    uniqueUsersWrongCount: row.unique_users_wrong_count,
    uniqueUsersCorrectCount: row.unique_users_correct_count,
    uniqueTestsCount: row.unique_tests_count,
    lowConfidenceRate: row.low_confidence_rate,
    fullData: mapFullData(fullDataMap.get(row.question_id)),
    reviewHistory: reviewMap.get(row.question_id) || [],
  }))
}

// ============================================
// HELPERS
// ============================================

interface FullQuestionRow {
  id: string
  question_text: string
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  correct_option: number
  explanation: string | null
  article_number: string | null
  article_title: string | null
  law_name: string | null
  law_short_name: string | null
}

async function getFullQuestionData(questionIds: string[]): Promise<FullQuestionRow[]> {
  if (!questionIds.length) return []
  const db = getDb()

  const idList = questionIds.map(id => `'${id}'::uuid`).join(', ')

  const rows = await db.execute(sql.raw(`
    SELECT
      q.id,
      q.question_text,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.correct_option,
      q.explanation,
      a.article_number,
      a.title AS article_title,
      l.name AS law_name,
      l.short_name AS law_short_name
    FROM questions q
    LEFT JOIN articles a ON a.id = q.primary_article_id
    LEFT JOIN laws l ON l.id = a.law_id
    WHERE q.id IN (${idList})
  `))

  return rows as unknown as FullQuestionRow[]
}

interface ReviewRow {
  id: string
  question_id: string | null
  detection_type: string
  status: string | null
  resolved_at: string | null
  admin_notes: string | null
  resolution_action: string | null
  failure_rate: number | null
  abandonment_rate: number | null
  users_affected: number | null
  detected_at: string | null
  admin_full_name: string | null
}

async function getReviewHistory(questionIds: string[]): Promise<ReviewRow[]> {
  if (!questionIds.length) return []
  const db = getDb()

  const idList = questionIds.map(id => `'${id}'::uuid`).join(', ')

  const rows = await db.execute(sql.raw(`
    SELECT
      pqt.id,
      pqt.question_id,
      pqt.detection_type,
      pqt.status,
      pqt.resolved_at,
      pqt.admin_notes,
      pqt.resolution_action,
      pqt.failure_rate::numeric AS failure_rate,
      pqt.abandonment_rate::numeric AS abandonment_rate,
      pqt.users_affected,
      pqt.detected_at,
      awr.full_name AS admin_full_name
    FROM problematic_questions_tracking pqt
    LEFT JOIN admin_users_with_roles awr ON awr.user_id = pqt.resolved_by
    WHERE pqt.question_id IN (${idList})
    ORDER BY pqt.detected_at DESC
  `))

  return rows as unknown as ReviewRow[]
}

function groupReviewsByQuestionId(rows: ReviewRow[]): Map<string, ReviewHistoryItem[]> {
  const map = new Map<string, ReviewHistoryItem[]>()
  for (const row of rows) {
    const qid = row.question_id
    if (!qid) continue
    if (!map.has(qid)) map.set(qid, [])
    map.get(qid)!.push({
      id: row.id,
      question_id: row.question_id,
      detection_type: row.detection_type,
      status: row.status,
      resolved_at: row.resolved_at,
      admin_notes: row.admin_notes,
      resolution_action: row.resolution_action,
      failure_rate: row.failure_rate ? Number(row.failure_rate) : null,
      abandonment_rate: row.abandonment_rate ? Number(row.abandonment_rate) : null,
      users_affected: row.users_affected,
      detected_at: row.detected_at,
      admin_full_name: row.admin_full_name,
    })
  }
  return map
}

function mapFullData(row: FullQuestionRow | undefined): FullQuestionData | null {
  if (!row) return null
  return {
    question_text: row.question_text,
    option_a: row.option_a,
    option_b: row.option_b,
    option_c: row.option_c,
    option_d: row.option_d,
    correct_option: row.correct_option,
    explanation: row.explanation,
    articles: row.article_number ? {
      article_number: row.article_number,
      title: row.article_title,
      laws: row.law_name ? {
        name: row.law_name,
        short_name: row.law_short_name,
      } : null,
    } : null,
  }
}

// ============================================
// IN-MEMORY CACHE (admin page, 5 min TTL)
// ============================================

let cachedResult: AnalyticsResponse | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ============================================
// MAIN EXPORT
// ============================================

export async function getAnalyticsData(): Promise<AnalyticsResponse> {
  // Return cached result if fresh
  if (cachedResult && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedResult
  }

  try {
    // Run sequentially to avoid Supabase connection contention
    const problematicQuestions = await getProblematicQuestions(15)
    const frequentlyFailedQuestions = await getFrequentlyFailedQuestions(15)

    const result = { problematicQuestions, frequentlyFailedQuestions }

    // Cache the result
    cachedResult = result
    cacheTimestamp = Date.now()

    return result
  } catch (error) {
    console.error('❌ [AdminAnalytics] Error fetching analytics data:', error)
    throw error
  }
}
