// lib/api/tests/queries.ts - Queries tipadas para tests
import { getDb } from '@/db/client'
import { tests, testQuestions, userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type {
  RecoverTestRequest,
  RecoverTestResponse,
  PendingTest,
} from './schemas'

// ============================================
// RECUPERAR TEST DESDE LOCALSTORAGE
// ============================================
// Guarda un test que el usuario hizo antes de registrarse

export async function recoverTest(
  params: RecoverTestRequest
): Promise<RecoverTestResponse> {
  try {
    const db = getDb()
    const { userId, pendingTest } = params

    // Calcular métricas
    const totalQuestions = pendingTest.answeredQuestions.length
    const correctAnswers = typeof pendingTest.score === 'number'
      ? pendingTest.score
      : pendingTest.answeredQuestions.filter(q => q.correct).length
    const incorrectAnswers = totalQuestions - correctAnswers
    const percentage = totalQuestions > 0
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : 0

    // Calcular tiempo total
    const totalTimeSeconds = pendingTest.startTime
      ? Math.round((pendingTest.savedAt - pendingTest.startTime) / 1000)
      : 0

    // 1. Crear el test
    const [newTest] = await db.insert(tests).values({
      userId: userId,
      title: `Test recuperado - Tema ${pendingTest.tema}`,
      testType: 'practice',
      totalQuestions: totalQuestions,
      startedAt: new Date(pendingTest.startTime || pendingTest.savedAt).toISOString(),
      completedAt: new Date(pendingTest.savedAt).toISOString(),
      isCompleted: true,
      score: String(percentage),
      totalTimeSeconds: totalTimeSeconds,
      temaNumber: pendingTest.tema,
      testNumber: pendingTest.testNumber || 0,
      testUrl: pendingTest.pageUrl || '/test-recuperado',
      detailedAnalytics: {
        recovered: true,
        recoveredAt: new Date().toISOString(),
        originalUrl: pendingTest.pageUrl,
      },
    }).returning({ id: tests.id })

    if (!newTest?.id) {
      throw new Error('No se pudo crear el test')
    }

    console.log('✅ [DRIZZLE] Test creado:', newTest.id)

    // 2. Guardar respuestas detalladas
    // NOTA: Solo insertar respuestas que tienen question_id válido
    // porque hay un trigger que requiere question_id no nulo
    if (pendingTest.detailedAnswers && pendingTest.detailedAnswers.length > 0) {
      const answersToInsert = pendingTest.detailedAnswers
        .filter((answer) => {
          // Verificar que tiene un ID de pregunta válido (UUID)
          const questionId = answer.questionData?.id
          return questionId && typeof questionId === 'string' && questionId.length > 0
        })
        .map((answer, index) => {
          // Mapear índices de respuesta a letras
          const answerLetters = ['A', 'B', 'C', 'D']
          const userAnswerLetter = answerLetters[answer.selectedAnswer] || 'A'
          const correctAnswerLetter = answerLetters[answer.correctAnswer] || 'A'

          return {
            testId: newTest.id,
            questionId: answer.questionData!.id!,
            questionOrder: index + 1,
            questionText: answer.questionData?.question || 'Pregunta recuperada',
            userAnswer: userAnswerLetter,
            correctAnswer: correctAnswerLetter,
            isCorrect: answer.isCorrect,
            timeSpentSeconds: answer.timeSpent || 0,
            confidenceLevel: answer.confidence || null,
            interactionCount: answer.interactions || 1,
            temaNumber: pendingTest.tema,
            articleNumber: answer.questionData?.article?.number || null,
            lawName: answer.questionData?.article?.law_short_name || null,
            fullQuestionContext: {
              options: answer.questionData?.options || [],
              recovered: true,
            },
          }
        })

      if (answersToInsert.length > 0) {
        await db.insert(testQuestions).values(answersToInsert)
        console.log('✅ [DRIZZLE] Respuestas guardadas:', answersToInsert.length)
      } else {
        console.log('⚠️ [DRIZZLE] No hay respuestas con question_id válido para guardar')
      }
    }

    // 3. Verificar si necesita onboarding
    const [profile] = await db
      .select({
        targetOposicion: userProfiles.targetOposicion,
        onboardingCompletedAt: userProfiles.onboardingCompletedAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    const needsOnboarding = profile && !profile.targetOposicion && !profile.onboardingCompletedAt

    return {
      success: true,
      testId: newTest.id,
      totalQuestions,
      correctAnswers,
      incorrectAnswers,
      percentage,
      totalTimeSeconds,
      tema: pendingTest.tema,
      needsOnboarding: needsOnboarding || false,
    }

  } catch (error) {
    console.error('❌ [DRIZZLE] Error recuperando test:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// VERIFICAR PERFIL PARA ONBOARDING
// ============================================

export async function checkNeedsOnboarding(userId: string): Promise<boolean> {
  try {
    const db = getDb()

    const [profile] = await db
      .select({
        targetOposicion: userProfiles.targetOposicion,
        onboardingCompletedAt: userProfiles.onboardingCompletedAt,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    return !!(profile && !profile.targetOposicion && !profile.onboardingCompletedAt)
  } catch (error) {
    console.error('Error verificando onboarding:', error)
    return false
  }
}
