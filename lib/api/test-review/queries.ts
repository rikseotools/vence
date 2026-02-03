// lib/api/test-review/queries.ts - Queries tipadas para revisión de tests completados
import { getDb } from '@/db/client'
import { tests, testQuestions } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
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

    // 3. Transformar datos para la respuesta
    const questions: ReviewQuestion[] = answers.map((a, index) => {
      const context = (a.fullQuestionContext as Record<string, unknown>) || {}

      return {
        id: a.questionId || a.psychometricQuestionId || a.id,
        order: a.questionOrder ?? index + 1,
        questionText: a.questionText || (context.question_text as string) || 'Pregunta no disponible',
        options: (context.options as string[]) || [],
        difficulty: a.difficulty || 'medium',
        tema: a.temaNumber,
        articleNumber: a.articleNumber,
        lawName: a.lawName,
        explanation: (context.explanation as string) || null,
        article: (context.article_full as string) || null,
        isPsychometric: !!a.psychometricQuestionId,
        // Datos de la respuesta del usuario
        userAnswer: a.userAnswer || null, // 'A', 'B', 'C', 'D' o null
        correctAnswer: a.correctAnswer, // 'A', 'B', 'C', 'D'
        isCorrect: a.isCorrect,
        timeSpent: a.timeSpentSeconds || 0,
      }
    })

    // 4. Calcular estadísticas
    const totalQuestions = questions.length
    const correctCount = questions.filter(q => q.isCorrect).length
    const incorrectCount = questions.filter(q => !q.isCorrect && q.userAnswer).length
    const blankCount = questions.filter(q => !q.userAnswer).length
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

    // 5. Agrupar por tema para resumen
    const byTema: Record<number, { total: number; correct: number }> = {}
    questions.forEach(q => {
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
    questions.forEach(q => {
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
      questions,
    }
  } catch (error) {
    console.error('❌ [DRIZZLE] Error getting test review:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    }
  }
}
