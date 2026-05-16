// lib/api/tests/queries.ts - Queries tipadas para tests
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getTestsDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { tests, testQuestions, userProfiles, questions, articles, laws, topics, topicScope } from '@/db/schema'
import { eq, sql, inArray, gte, and, desc } from 'drizzle-orm'
import { getAllowedLawIds } from '@/lib/api/oposicion-scope/queries'
import type {
  RecoverTestRequest,
  RecoverTestResponse,
  PendingTest,
} from './schemas'

/**
 * Genera título descriptivo para un test recuperado.
 * Consulta la ley de la primera pregunta para dar contexto.
 * Fallback: "Test recuperado" si no se puede determinar.
 */
async function generateRecoveredTestTitle(
  db: ReturnType<typeof getDb>,
  pendingTest: PendingTest
): Promise<string> {
  try {
    // Intentar obtener el nombre de la ley de la primera pregunta
    const firstQuestionData = pendingTest.questions?.[0]
    const questionId = firstQuestionData?.id

    if (questionId && questionId.length > 10) {
      const result = await db
        .select({ shortName: laws.shortName })
        .from(questions)
        .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
        .innerJoin(laws, eq(articles.lawId, laws.id))
        .where(eq(questions.id, questionId))
        .limit(1)

      if (result[0]?.shortName) {
        const tema = pendingTest.tema ? ` - Tema ${pendingTest.tema}` : ''
        return `Test recuperado - ${result[0].shortName}${tema}`
      }
    }
  } catch {
    // No bloquear si falla
  }

  // Fallback
  if (pendingTest.tema && pendingTest.tema > 0) {
    return `Test recuperado - Tema ${pendingTest.tema}`
  }
  return 'Test recuperado'
}

// ============================================
// RECUPERAR TEST DESDE LOCALSTORAGE
// ============================================
// Guarda un test que el usuario hizo antes de registrarse

export async function recoverTest(
  params: RecoverTestRequest
): Promise<RecoverTestResponse> {
  try {
    const db = getTestsDb()
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

    // Generar título descriptivo desde los datos disponibles
    const title = await generateRecoveredTestTitle(db, pendingTest)

    // 1. Crear el test
    const [newTest] = await db.insert(tests).values({
      userId: userId,
      title,
      testType: 'practice',
      totalQuestions: totalQuestions,
      startedAt: new Date(pendingTest.startTime || pendingTest.savedAt).toISOString(),
      completedAt: new Date(pendingTest.savedAt).toISOString(),
      isCompleted: true,
      score: String(correctAnswers),
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
          // selectedAnswer === -1 marca "dejada en blanco" (feature 15/04/2026)
          const answerLetters = ['A', 'B', 'C', 'D']
          const wasBlank = answer.selectedAnswer === -1
          const userAnswerLetter = wasBlank ? 'BLANK' : (answerLetters[answer.selectedAnswer] || 'A')
          const correctAnswerLetter = answerLetters[answer.correctAnswer] || 'A'

          return {
            testId: newTest.id,
            questionId: answer.questionData!.id!,
            questionOrder: index + 1,
            questionText: answer.questionData?.question || 'Pregunta recuperada',
            userAnswer: userAnswerLetter,
            correctAnswer: correctAnswerLetter,
            isCorrect: answer.isCorrect,
            wasBlank,
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
            userId,
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
    const db = getTestsDb()

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
    const db = getTestsDb()

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
      case 'oldest':
        // Más antiguas primero (refuerzo de conceptos olvidados)
        sortedQuestions.sort((a, b) =>
          new Date(a.lastFail).getTime() - new Date(b.lastFail).getTime()
        )
        break
      case 'random':
        // Fisher–Yates in-place
        for (let i = sortedQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[sortedQuestions[i], sortedQuestions[j]] = [sortedQuestions[j], sortedQuestions[i]]
        }
        break
      default: // 'recent'
        sortedQuestions.sort((a, b) =>
          new Date(b.lastFail).getTime() - new Date(a.lastFail).getTime()
        )
    }

    // Cuando hay scope (filtro por bloque/temas) NO podemos pre-cortar a numQuestions,
    // porque los N más recientes podrían ser todos de OTRO bloque y el filtro
    // dejaría 0 resultados. Traemos todos los IDs y limitamos tras aplicar el filtro.
    const hasScope = !!params.scope
    const questionIds = hasScope
      ? sortedQuestions.map(q => q.questionId)
      : sortedQuestions.slice(0, numQuestions).map(q => q.questionId)
    console.log(`🎯 [DRIZZLE] Returning ${questionIds.length} question IDs (hasScope=${hasScope})`)

    if (!questionIds.length) {
      return {
        success: true,
        questions: [],
        questionCount: 0,
        message: `No hay preguntas falladas en ${periodLabel}`,
      }
    }

    // Paso 3: Cargar preguntas completas con artículos y leyes (filtradas por scope)
    const allowed = await getAllowedLawIds({ userId })
    const scopeFilter = allowed.lawIds.length > 0
      ? inArray(laws.id, allowed.lawIds)
      : sql`true`

    // Filtro opcional por bloque/temas (feature 06/05/2026, feedback Alba).
    // Si viene scope, resolver topic_numbers (BD si type=block, directo si type=topic)
    // y aplicar EXISTS contra topic_scope×topics. position_type aísla cross-oposición
    // (mismo patrón que getAllowedLawIds / lib/api/oposicion-scope/queries.ts:117).
    let blockFilter = sql`true`
    if (params.scope) {
      const positionType = params.scope.positionType

      if (params.scope.type === 'position') {
        // Toda la oposición: cualquier pregunta cuyo artículo esté en algún
        // topic_scope de un topic activo de esa posición. Card "Debilidades".
        blockFilter = sql`EXISTS (
          SELECT 1 FROM ${topicScope} ts
          INNER JOIN ${topics} t ON t.id = ts.topic_id
          WHERE ts.law_id = ${articles.lawId}
            AND ${articles.articleNumber} = ANY(ts.article_numbers)
            AND t.position_type = ${positionType}
            AND t.is_active = true
        )`
        console.log(`🎯 [DRIZZLE] scope=position positionType=${positionType}`)
      } else {
        // 'block' o 'topic': resolver topic_numbers
        let topicNumbers: number[] = []

        if (params.scope.type === 'block') {
          const topicRows = await db
            .select({ topicNumber: topics.topicNumber })
            .from(topics)
            .where(and(
              eq(topics.positionType, positionType),
              sql`${topics.bloqueNumber} = ${params.scope.bloqueNumber}`,
              eq(topics.isActive, true),
            ))
          topicNumbers = topicRows.map(r => r.topicNumber)

          if (topicNumbers.length === 0) {
            return {
              success: true,
              questions: [],
              questionCount: 0,
              message: `El Bloque ${params.scope.bloqueNumber} no tiene temas activos en esta oposición`,
            }
          }
        } else {
          topicNumbers = params.scope.topicNumbers
        }

        blockFilter = sql`EXISTS (
          SELECT 1 FROM ${topicScope} ts
          INNER JOIN ${topics} t ON t.id = ts.topic_id
          WHERE ts.law_id = ${articles.lawId}
            AND ${articles.articleNumber} = ANY(ts.article_numbers)
            AND t.position_type = ${positionType}
            AND t.topic_number IN (${sql.join(topicNumbers, sql`, `)})
        )`

        console.log(`🎯 [DRIZZLE] scope=${params.scope.type} positionType=${positionType} topics=${topicNumbers.length}`)
      }
    }

    const questionsWithDetails = await db
      .select({
        id: questions.id,
        questionText: questions.questionText,
        optionA: questions.optionA,
        optionB: questions.optionB,
        optionC: questions.optionC,
        optionD: questions.optionD,
        optionE: questions.optionE,
        explanation: questions.explanation,
        correctOption: questions.correctOption,
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
        lawShortName: laws.shortName,
        lawActualSlug: laws.slug,
      })
      .from(questions)
      .innerJoin(articles, eq(questions.primaryArticleId, articles.id))
      .innerJoin(laws, eq(articles.lawId, laws.id))
      .where(
        and(
          inArray(questions.id, questionIds),
          eq(questions.isActive, true),
          scopeFilter,
          blockFilter
        )
      )

    if (!questionsWithDetails.length) {
      // Distinguir caso "scope activo y bloque/temas sin fallos" del caso de error real
      if (hasScope) {
        return {
          success: true,
          questions: [],
          questionCount: 0,
          message: `¡Enhorabuena! No tienes preguntas falladas en este bloque en ${periodLabel}`,
        }
      }
      return {
        success: false,
        error: 'Las preguntas falladas ya no están disponibles',
      }
    }

    // Si hay scope, respetar el orderBy original y limitar a numQuestions
    // (en paso 2 trajimos todas las falladas, no las primeras N).
    let finalResults = questionsWithDetails
    if (hasScope && questionsWithDetails.length > numQuestions) {
      const idOrder = new Map(sortedQuestions.map((q, i) => [q.questionId, i]))
      finalResults = [...questionsWithDetails].sort((a, b) =>
        (idOrder.get(a.id) ?? Infinity) - (idOrder.get(b.id) ?? Infinity)
      ).slice(0, numQuestions)
    }

    // Transformar al formato de TestLayout
    const formattedQuestions: TestLayoutQuestion[] = finalResults.map(q => ({
      id: q.id,
      question: q.questionText,
      question_text: q.questionText,
      options: [q.optionA, q.optionB, q.optionC, q.optionD, q.optionE].filter((v): v is string => v != null && v !== ''),
      explanation: q.explanation,
      correct_option: q.correctOption,
      difficulty: q.difficulty,
      primary_article_id: q.primaryArticleId,
      article_number: q.articleNumber,
      article_title: q.articleTitle,
      law_name: q.lawName || 'Desconocida',
      law_slug: q.lawShortName,
      law_actual_slug: q.lawActualSlug,
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
