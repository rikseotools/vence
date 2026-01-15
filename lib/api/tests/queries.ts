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

// ============================================
// TEST DE REPASO DE FALLOS (Drizzle + Zod)
// ============================================

import { questions, articles, laws } from '@/db/schema'
import { inArray, gte, and, sql, desc } from 'drizzle-orm'
import type {
  CreateFailedQuestionsTestRequest,
  CreateFailedQuestionsTestResponse,
  TestLayoutQuestion,
} from './schemas'

interface FailedQuestionData {
  questionId: string
  failCount: number
  lastFail: string
}

/**
 * Obtiene las preguntas falladas de un usuario en un período
 * Filtra por test_questions.created_at (igual que el RPC get_user_statistics_complete)
 */
export async function getFailedQuestionsForUser(
  params: CreateFailedQuestionsTestRequest
): Promise<CreateFailedQuestionsTestResponse> {
  const { userId, numQuestions = 10, orderBy = 'recent', fromDate, days = 30 } = params

  try {
    const db = getDb()

    // Calcular fecha de corte
    const cutoffDate = fromDate
      ? new Date(fromDate)
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const periodLabel = fromDate ? 'período especificado' : `últimos ${days} días`
    console.log(`🎯 [DRIZZLE] Cutoff date: ${cutoffDate.toISOString()} | Period: ${periodLabel}`)

    // Paso 1: Obtener todos los test_ids del usuario
    const userTests = await db
      .select({ id: tests.id })
      .from(tests)
      .where(eq(tests.userId, userId))

    if (!userTests.length) {
      return {
        success: true,
        questions: [],
        questionCount: 0,
        message: 'No tienes tests realizados',
      }
    }

    const testIds = userTests.map(t => t.id)
    console.log(`🎯 [DRIZZLE] Found ${testIds.length} total tests for user`)

    // Paso 2: Obtener respuestas falladas filtrando por created_at
    const failedAnswers = await db
      .select({
        questionId: testQuestions.questionId,
        createdAt: testQuestions.createdAt,
      })
      .from(testQuestions)
      .where(
        and(
          inArray(testQuestions.testId, testIds),
          eq(testQuestions.isCorrect, false),
          gte(testQuestions.createdAt, cutoffDate.toISOString())
        )
      )

    if (!failedAnswers.length) {
      return {
        success: true,
        questions: [],
        questionCount: 0,
        message: `¡Enhorabuena! No tienes preguntas falladas en ${periodLabel}`,
      }
    }

    console.log(`🎯 [DRIZZLE] Found ${failedAnswers.length} failed answers`)

    // Agrupar por questionId y contar fallos
    const questionFailCounts: Record<string, FailedQuestionData> = {}
    failedAnswers.forEach(a => {
      if (!a.questionId) return
      if (!questionFailCounts[a.questionId]) {
        questionFailCounts[a.questionId] = {
          questionId: a.questionId,
          failCount: 0,
          lastFail: a.createdAt || '',
        }
      }
      questionFailCounts[a.questionId].failCount++
      if (a.createdAt && a.createdAt > questionFailCounts[a.questionId].lastFail) {
        questionFailCounts[a.questionId].lastFail = a.createdAt
      }
    })

    // Ordenar según criterio
    let sortedQuestions = Object.values(questionFailCounts)
    switch (orderBy) {
      case 'most_failed':
      case 'worst_accuracy':
        sortedQuestions.sort((a, b) => b.failCount - a.failCount)
        break
      default: // 'recent'
        sortedQuestions.sort((a, b) =>
          new Date(b.lastFail).getTime() - new Date(a.lastFail).getTime()
        )
    }

    const questionIds = sortedQuestions.slice(0, numQuestions).map(q => q.questionId)
    console.log(`🎯 [DRIZZLE] Returning ${questionIds.length} question IDs`)

    if (!questionIds.length) {
      return {
        success: true,
        questions: [],
        questionCount: 0,
        message: `No hay preguntas falladas en ${periodLabel}`,
      }
    }

    // Paso 3: Cargar preguntas completas con artículos y leyes
    const questionsWithDetails = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        explanation: questions.explanation,
        difficulty: questions.difficulty,
        primaryArticleId: questions.primaryArticleId,
        isOfficialExam: questions.isOfficialExam,
        examSource: questions.examSource,
        examDate: questions.examDate,
        examEntity: questions.examEntity,
        globalDifficultyCategory: questions.globalDifficultyCategory,
        // Artículo
        articleNumber: articles.articleNumber,
        articleTitle: articles.title,
        // Ley
        lawName: laws.name,
        lawSlug: laws.shortName,
      })
      .from(questions)
      .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
      .leftJoin(laws, eq(articles.lawId, laws.id))
      .where(
        and(
          inArray(questions.id, questionIds),
          eq(questions.isActive, true)
        )
      )

    if (!questionsWithDetails.length) {
      return {
        success: false,
        error: 'Las preguntas falladas ya no están disponibles',
      }
    }

    // Transformar al formato de TestLayout
    const formattedQuestions: TestLayoutQuestion[] = questionsWithDetails.map(q => ({
      id: q.id,
      question: q.questionText,
      question_text: q.questionText,
      options: [q.optionA, q.optionB, q.optionC, q.optionD] as [string, string, string, string],
      explanation: q.explanation,
      difficulty: q.difficulty,
      primary_article_id: q.primaryArticleId,
      article_number: q.articleNumber,
      article_title: q.articleTitle,
      law_name: q.lawName || 'Desconocida',
      law_slug: q.lawSlug,
      is_official_exam: q.isOfficialExam || false,
      exam_source: q.examSource,
      exam_date: q.examDate,
      exam_entity: q.examEntity,
      global_difficulty_category: q.globalDifficultyCategory,
    }))

    console.log(`🎯 [DRIZZLE] Returning ${formattedQuestions.length} formatted questions`)

    return {
      success: true,
      questions: formattedQuestions,
      questionCount: formattedQuestions.length,
      message: `Test de repaso con ${formattedQuestions.length} preguntas falladas en ${periodLabel}`,
    }

  } catch (error) {
    console.error('❌ [DRIZZLE] Error getting failed questions:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
