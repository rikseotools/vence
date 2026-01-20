// lib/api/user-failed-questions/queries.ts - Queries Drizzle para preguntas falladas del usuario
import { getDb } from '@/db/client'
import { questions, articles, laws, tests, testQuestions } from '@/db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import type {
  GetUserFailedQuestionsRequest,
  GetUserFailedQuestionsResponse,
  FailedQuestionItem,
} from './schemas'

// ============================================
// OBTENER PREGUNTAS FALLADAS DEL USUARIO
// ============================================
export async function getUserFailedQuestions(
  params: GetUserFailedQuestionsRequest
): Promise<GetUserFailedQuestionsResponse> {
  try {
    const db = getDb()
    const { userId, topicNumber, selectedLaws } = params

    console.log(`🔍 [v2] Cargando preguntas falladas para usuario ${userId.substring(0, 8)}...`)

    // Construir condiciones de filtro
    const conditions = [
      eq(tests.userId, userId),
      eq(testQuestions.isCorrect, false),
      eq(questions.isActive, true),
    ]

    // Filtrar por tema si se especifica
    if (topicNumber) {
      conditions.push(eq(testQuestions.temaNumber, topicNumber))
    }

    // Filtrar por leyes si se especifican
    if (selectedLaws && selectedLaws.length > 0) {
      conditions.push(inArray(laws.shortName, selectedLaws))
    }

    // Si no hay ni tema ni leyes, no podemos filtrar
    if (!topicNumber && (!selectedLaws || selectedLaws.length === 0)) {
      return {
        success: false,
        error: 'Debe especificar un tema o leyes para buscar preguntas falladas',
      }
    }

    // Query principal: obtener todas las respuestas incorrectas
    const failedAnswers = await db
      .select({
        questionId: testQuestions.questionId,
        createdAt: testQuestions.createdAt,
        timeSpentSeconds: testQuestions.timeSpentSeconds,
        questionText: questions.questionText,
        difficulty: questions.difficulty,
        articleNumber: articles.articleNumber,
        lawShortName: laws.shortName,
      })
      .from(testQuestions)
      .innerJoin(tests, eq(testQuestions.testId, tests.id))
      .innerJoin(questions, eq(testQuestions.questionId, questions.id))
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(and(...conditions))
      .orderBy(desc(testQuestions.createdAt))

    if (!failedAnswers || failedAnswers.length === 0) {
      return {
        success: true,
        totalQuestions: 0,
        totalFailures: 0,
        questions: [],
      }
    }

    // Procesar y agrupar las preguntas falladas
    const failedQuestionsMap = new Map<string, FailedQuestionItem>()

    for (const answer of failedAnswers) {
      const questionId = answer.questionId
      if (!questionId) continue

      if (!failedQuestionsMap.has(questionId)) {
        failedQuestionsMap.set(questionId, {
          questionId,
          questionText: answer.questionText
            ? answer.questionText.substring(0, 80) + '...'
            : 'Pregunta sin texto',
          difficulty: answer.difficulty,
          articleNumber: answer.articleNumber,
          lawShortName: answer.lawShortName,
          failedCount: 0,
          lastFailed: answer.createdAt || new Date().toISOString(),
          firstFailed: answer.createdAt || new Date().toISOString(),
          totalTime: 0,
        })
      }

      const question = failedQuestionsMap.get(questionId)!
      question.failedCount++
      question.totalTime += answer.timeSpentSeconds || 0

      // Actualizar fechas
      const answerDate = new Date(answer.createdAt || 0)
      if (answerDate > new Date(question.lastFailed)) {
        question.lastFailed = answer.createdAt || question.lastFailed
      }
      if (answerDate < new Date(question.firstFailed)) {
        question.firstFailed = answer.createdAt || question.firstFailed
      }
    }

    const failedQuestionsList = Array.from(failedQuestionsMap.values())

    console.log(`✅ [v2] Encontradas ${failedQuestionsList.length} preguntas falladas (${failedAnswers.length} fallos totales)`)

    return {
      success: true,
      totalQuestions: failedQuestionsList.length,
      totalFailures: failedAnswers.length,
      questions: failedQuestionsList,
    }
  } catch (error) {
    console.error('❌ [v2] Error obteniendo preguntas falladas:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
