// lib/api/test-review/queries.ts - Queries tipadas para revisión de tests completados
import { getDb } from '@/db/client'
import { tests, testQuestions, questions } from '@/db/schema'
import { eq, asc, inArray } from 'drizzle-orm'
import type {
  GetTestReviewRequest,
  GetTestReviewResponse,
  ReviewQuestion,
  TemaBreakdown,
  DifficultyBreakdown,
} from './schemas'

// ============================================
// OBTENER DATOS PARA REVISIÓN DE TEST
// ============================================

export async function getTestReview(
  params: GetTestReviewRequest
): Promise<GetTestReviewResponse> {
  try {
    const db = getDb()
    const { testId } = params

    // 1. Obtener datos del test
    const [test] = await db
      .select({
        id: tests.id,
        userId: tests.userId,
        title: tests.title,
        testType: tests.testType,
        temaNumber: tests.temaNumber,
        score: tests.score,
        totalQuestions: tests.totalQuestions,
        isCompleted: tests.isCompleted,
        completedAt: tests.completedAt,
        createdAt: tests.createdAt,
        totalTimeSeconds: tests.totalTimeSeconds,
      })
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1)

    if (!test) {
      return {
        success: false,
        error: 'Test no encontrado',
      }
    }

    // Verificar que el test está completado
    if (!test.isCompleted) {
      return {
        success: false,
        error: 'El test no está completado',
      }
    }

    // 2. Obtener las respuestas del usuario
    const answers = await db
      .select({
        id: testQuestions.id,
        questionId: testQuestions.questionId,
        psychometricQuestionId: testQuestions.psychometricQuestionId,
        questionOrder: testQuestions.questionOrder,
        questionText: testQuestions.questionText,
        userAnswer: testQuestions.userAnswer,
        correctAnswer: testQuestions.correctAnswer,
        isCorrect: testQuestions.isCorrect,
        timeSpentSeconds: testQuestions.timeSpentSeconds,
        difficulty: testQuestions.difficulty,
        temaNumber: testQuestions.temaNumber,
        articleNumber: testQuestions.articleNumber,
        lawName: testQuestions.lawName,
        fullQuestionContext: testQuestions.fullQuestionContext,
      })
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId))
      .orderBy(asc(testQuestions.questionOrder))

    // 2b. Fallback: cargar opciones/explicación de la tabla questions cuando full_question_context está vacío
    const questionIdsNeedingContext = answers
      .filter(a => {
        const ctx = a.fullQuestionContext as Record<string, unknown> | null
        return !ctx || !Array.isArray((ctx as Record<string, unknown>).options) || ((ctx as Record<string, unknown>).options as unknown[]).length === 0
      })
      .map(a => a.questionId)
      .filter((id): id is string => !!id)

    const questionDataMap = new Map<string, { options: string[]; explanation: string | null }>()

    if (questionIdsNeedingContext.length > 0) {
      const questionRows = await db
        .select({
          id: questions.id,
          optionA: questions.optionA,
          optionB: questions.optionB,
          optionC: questions.optionC,
          optionD: questions.optionD,
          explanation: questions.explanation,
        })
        .from(questions)
        .where(inArray(questions.id, questionIdsNeedingContext))

      for (const q of questionRows) {
        questionDataMap.set(q.id, {
          options: [q.optionA, q.optionB, q.optionC, q.optionD],
          explanation: q.explanation,
        })
      }

      console.log(`🔄 [DRIZZLE] Loaded ${questionRows.length} questions as fallback for missing full_question_context`)
    }

    // 3. Transformar datos para la respuesta
    const reviewQuestions: ReviewQuestion[] = answers.map((a, index) => {
      const context = (a.fullQuestionContext as Record<string, unknown>) || {}
      const fallback = a.questionId ? questionDataMap.get(a.questionId) : undefined
      const contextOptions = Array.isArray(context.options) && (context.options as string[]).length > 0
        ? (context.options as string[])
        : null

      return {
        id: a.questionId || a.psychometricQuestionId || a.id,
        order: a.questionOrder ?? index + 1,
        questionText: a.questionText || (context.question_text as string) || 'Pregunta no disponible',
        options: contextOptions || fallback?.options || [],
        difficulty: a.difficulty || 'medium',
        tema: a.temaNumber,
        articleNumber: a.articleNumber,
        lawName: a.lawName,
        explanation: (context.explanation as string) || fallback?.explanation || null,
        article: typeof context.article_full === 'string'
          ? context.article_full
          : (context.article_full as Record<string, unknown>)?.full_text as string || null,
        isPsychometric: !!a.psychometricQuestionId,
        // Datos de la respuesta del usuario
        userAnswer: a.userAnswer || null, // 'A', 'B', 'C', 'D' o null
        correctAnswer: a.correctAnswer, // 'A', 'B', 'C', 'D'
        isCorrect: a.isCorrect,
        timeSpent: a.timeSpentSeconds || 0,
      }
    })

    // 4. Calcular estadísticas
    const totalQuestions = reviewQuestions.length
    const correctCount = reviewQuestions.filter(q => q.isCorrect).length
    const incorrectCount = reviewQuestions.filter(q => !q.isCorrect && q.userAnswer).length
    const blankCount = reviewQuestions.filter(q => !q.userAnswer).length
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

    // 5. Agrupar por tema para resumen
    const byTema: Record<number, { total: number; correct: number }> = {}
    reviewQuestions.forEach(q => {
      if (q.tema) {
        if (!byTema[q.tema]) {
          byTema[q.tema] = { total: 0, correct: 0 }
        }
        byTema[q.tema].total++
        if (q.isCorrect) byTema[q.tema].correct++
      }
    })

    const temaBreakdown: TemaBreakdown[] = Object.entries(byTema)
      .map(([tema, stats]) => ({
        tema: parseInt(tema),
        total: stats.total,
        correct: stats.correct,
        accuracy: Math.round((stats.correct / stats.total) * 100),
      }))
      .sort((a, b) => a.tema - b.tema)

    // 6. Agrupar por dificultad
    const byDifficulty: Record<string, { total: number; correct: number }> = {}
    reviewQuestions.forEach(q => {
      const diff = q.difficulty || 'medium'
      if (!byDifficulty[diff]) {
        byDifficulty[diff] = { total: 0, correct: 0 }
      }
      byDifficulty[diff].total++
      if (q.isCorrect) byDifficulty[diff].correct++
    })

    const difficultyBreakdown: DifficultyBreakdown[] = Object.entries(byDifficulty).map(
      ([difficulty, stats]) => ({
        difficulty,
        total: stats.total,
        correct: stats.correct,
        accuracy: Math.round((stats.correct / stats.total) * 100),
      })
    )

    console.log(`✅ [DRIZZLE] Test review loaded: ${totalQuestions} questions`)

    return {
      success: true,
      test: {
        id: test.id,
        title: test.title || 'Test sin título',
        testType: test.testType,
        tema: test.temaNumber,
        createdAt: test.createdAt,
        completedAt: test.completedAt,
        totalTimeSeconds: test.totalTimeSeconds || 0,
      },
      summary: {
        totalQuestions,
        correctCount,
        incorrectCount,
        blankCount,
        score: test.score,
        percentage,
      },
      temaBreakdown,
      difficultyBreakdown,
      questions: reviewQuestions,
    }
  } catch (error) {
    console.error('❌ [DRIZZLE] Error getting test review:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    }
  }
}
