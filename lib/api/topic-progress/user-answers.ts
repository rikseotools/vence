// lib/api/topic-progress/user-answers.ts
// Query optimizada para obtener respuestas del usuario con info de artículo

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

// ============================================
// TIPOS
// ============================================

export interface UserAnswer {
  answerId: string
  questionId: string
  isCorrect: boolean
  createdAt: Date
  timeSpentSeconds: number | null
  lawId: string
  articleNumber: string
  difficulty: string | null
}

// ============================================
// CACHÉ DE RESPUESTAS (30 segundos)
// ============================================

interface UserAnswersCacheEntry {
  answers: UserAnswer[]
  timestamp: number
}

const userAnswersCache = new Map<string, UserAnswersCacheEntry>()
const USER_ANSWERS_TTL = 30 * 1000 // 30 segundos

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

/**
 * Obtiene todas las respuestas del usuario que tienen artículo asociado.
 *
 * Query simple y eficiente:
 * - JOIN con questions para obtener primary_article_id
 * - JOIN con articles para obtener law_id y article_number
 * - NO usa ANY() ni CTEs complejas
 *
 * @param userId - ID del usuario
 * @returns Array de respuestas con info de artículo
 */
export async function getUserAnswersWithArticles(
  userId: string
): Promise<UserAnswer[]> {
  const cacheKey = `user-answers:${userId}`
  const cached = userAnswersCache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < USER_ANSWERS_TTL) {
    return cached.answers
  }

  const db = getDb()

  const result = await db.execute<{
    answer_id: string
    question_id: string
    is_correct: boolean
    created_at: string
    time_spent_seconds: number | null
    law_id: string
    article_number: string
    difficulty: string | null
  }>(sql`
    SELECT
      tq.id as answer_id,
      tq.question_id,
      tq.is_correct,
      tq.created_at::text,
      tq.time_spent_seconds,
      a.law_id,
      a.article_number,
      tq.difficulty
    FROM test_questions tq
    INNER JOIN tests t ON tq.test_id = t.id
    INNER JOIN questions q ON tq.question_id = q.id
    INNER JOIN articles a ON q.primary_article_id = a.id
    WHERE t.user_id = ${userId}
      AND q.primary_article_id IS NOT NULL
  `)

  const rows = Array.isArray(result) ? result : (result as any).rows || []

  const answers: UserAnswer[] = rows.map((row: any) => ({
    answerId: row.answer_id,
    questionId: row.question_id,
    isCorrect: row.is_correct,
    createdAt: new Date(row.created_at),
    timeSpentSeconds: row.time_spent_seconds ?? null,
    lawId: row.law_id,
    articleNumber: row.article_number,
    difficulty: row.difficulty,
  }))

  userAnswersCache.set(cacheKey, { answers, timestamp: Date.now() })

  return answers
}

// ============================================
// UTILIDADES DE CACHÉ
// ============================================

/**
 * Invalida el caché de respuestas para un usuario
 */
export function invalidateUserAnswersCache(userId: string): void {
  userAnswersCache.delete(`user-answers:${userId}`)
}

/**
 * Limpia todo el caché de respuestas
 */
export function clearAllUserAnswersCache(): void {
  userAnswersCache.clear()
}
