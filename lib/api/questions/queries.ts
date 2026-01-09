// lib/api/questions/queries.ts - Queries tipadas para historial de preguntas
import { getDb } from '@/db/client'
import { testQuestions, tests, questions } from '@/db/schema'
import { eq, and, gte, sql, desc } from 'drizzle-orm'
import type {
  GetQuestionHistoryRequest,
  GetQuestionHistoryResponse,
  GetRecentQuestionsRequest,
  GetRecentQuestionsResponse,
  QuestionHistoryItem,
  GetUserAnalyticsRequest,
  GetUserAnalyticsResponse,
  AnalyticsResponseItem,
} from './schemas'

// ============================================
// OBTENER HISTORIAL DE PREGUNTAS DEL USUARIO
// ============================================
// Esta query reemplaza el patrón lento de:
// 1. Obtener todos los test IDs del usuario
// 2. Hacer IN clause con 250+ UUIDs
//
// Ahora hace un JOIN directo que PostgreSQL optimiza mucho mejor

export async function getQuestionHistory(
  params: GetQuestionHistoryRequest
): Promise<GetQuestionHistoryResponse> {
  try {
    const db = getDb()
    const { userId, onlyActiveQuestions = true } = params

    // Query optimizada con JOIN directo (en lugar de IN clause con 250+ IDs)
    // Agrupa por question_id y obtiene la fecha más reciente de respuesta
    let query = db
      .select({
        questionId: testQuestions.questionId,
        lastAnsweredAt: sql<string>`MAX(${testQuestions.createdAt})`.as('last_answered_at'),
      })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .where(eq(tests.userId, userId))
      .groupBy(testQuestions.questionId)

    // Si solo queremos preguntas activas, añadir JOIN con questions
    let results: { questionId: string | null; lastAnsweredAt: string }[]

    if (onlyActiveQuestions) {
      results = await db
        .select({
          questionId: testQuestions.questionId,
          lastAnsweredAt: sql<string>`MAX(${testQuestions.createdAt})`.as('last_answered_at'),
        })
        .from(testQuestions)
        .innerJoin(tests, eq(testQuestions.testId, tests.id))
        .innerJoin(questions, eq(testQuestions.questionId, questions.id))
        .where(and(
          eq(tests.userId, userId),
          eq(questions.isActive, true)
        ))
        .groupBy(testQuestions.questionId)
    } else {
      results = await db
        .select({
          questionId: testQuestions.questionId,
          lastAnsweredAt: sql<string>`MAX(${testQuestions.createdAt})`.as('last_answered_at'),
        })
        .from(testQuestions)
        .innerJoin(tests, eq(testQuestions.testId, tests.id))
        .where(eq(tests.userId, userId))
        .groupBy(testQuestions.questionId)
    }

    // Filtrar nulls y transformar a formato esperado
    const history: QuestionHistoryItem[] = results
      .filter((r): r is { questionId: string; lastAnsweredAt: string } =>
        r.questionId !== null && r.lastAnsweredAt !== null
      )
      .map(r => ({
        questionId: r.questionId,
        lastAnsweredAt: r.lastAnsweredAt,
      }))

    return {
      success: true,
      history,
      totalAnswered: history.length,
    }
  } catch (error) {
    console.error('Error obteniendo historial de preguntas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// OBTENER PREGUNTAS RESPONDIDAS RECIENTEMENTE
// ============================================
// Para excluir preguntas respondidas en los últimos X días

export async function getRecentQuestions(
  params: GetRecentQuestionsRequest
): Promise<GetRecentQuestionsResponse> {
  try {
    const db = getDb()
    const { userId, days } = params

    // Calcular fecha de corte
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Query optimizada con JOIN directo
    const results = await db
      .selectDistinct({
        questionId: testQuestions.questionId,
      })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .where(and(
        eq(tests.userId, userId),
        gte(testQuestions.createdAt, cutoffDate)
      ))

    // Filtrar nulls
    const questionIds = results
      .filter((r): r is { questionId: string } => r.questionId !== null)
      .map(r => r.questionId)

    return {
      success: true,
      questionIds,
    }
  } catch (error) {
    console.error('Error obteniendo preguntas recientes:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// OBTENER RESPUESTAS PARA ANALYTICS
// ============================================
// Para motivationalAnalyzer - reemplaza el JOIN lento con tests

export async function getUserAnalytics(
  params: GetUserAnalyticsRequest
): Promise<GetUserAnalyticsResponse> {
  try {
    const db = getDb()
    const { userId, days } = params

    // Calcular fecha de corte
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    // Query optimizada con JOIN directo
    // Antes: SELECT ... FROM test_questions JOIN tests WHERE tests.user_id = X AND tests.completed_at >= Y
    // El problema era el JOIN sin índice optimizado
    const results = await db
      .select({
        id: testQuestions.id,
        createdAt: testQuestions.createdAt,
        isCorrect: testQuestions.isCorrect,
        lawName: testQuestions.lawName,
        articleNumber: testQuestions.articleNumber,
        temaNumber: testQuestions.temaNumber,
      })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .where(and(
        eq(tests.userId, userId),
        gte(testQuestions.createdAt, cutoffDate)
      ))
      .orderBy(desc(testQuestions.createdAt))
      .limit(500)

    // Transformar a formato esperado
    const responses: AnalyticsResponseItem[] = results.map(r => ({
      id: r.id,
      createdAt: r.createdAt || new Date().toISOString(),
      isCorrect: r.isCorrect,
      lawName: r.lawName,
      articleNumber: r.articleNumber,
      temaNumber: r.temaNumber,
    }))

    return {
      success: true,
      responses,
    }
  } catch (error) {
    console.error('Error obteniendo analytics del usuario:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
