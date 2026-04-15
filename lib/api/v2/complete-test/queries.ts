// lib/api/v2/complete-test/queries.ts
// Server-side: completar test con analytics (replica completeDetailedTest + updateUserProgressDirect)
import { getDb } from '@/db/client'
import { tests, testQuestions, userSessions, questions, psychometricQuestions } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import type { CompleteTestRequest, DetailedAnswerInput } from './schemas'
import { insertTestAnswersBatch } from '@/lib/api/test-answers'
import type { SaveAnswerRequest } from '@/lib/api/test-answers'

interface ArticleStat {
  article_id: string
  total: number
  correct: number
  time_spent: number
  law_name: string
}

// ============================================
// MAIN: Completar test
// ============================================

export async function completeTest(
  params: CompleteTestRequest,
  userId: string,
): Promise<{ success: boolean; status: 'saved' | 'error'; savedQuestionsCount?: number; gapFilledCount?: number }> {
  const db = getDb()

  const {
    sessionId,
    finalScore,
    detailedAnswers,
    startTime,
    interactionEvents,
    userSessionId,
  } = params

  // 1. Verificar que el test pertenece al usuario
  const [testRow] = await db
    .select({ id: tests.id, userId: tests.userId, temaNumber: tests.temaNumber })
    .from(tests)
    .where(and(eq(tests.id, sessionId), eq(tests.userId, userId)))
    .limit(1)

  if (!testRow) {
    console.error('❌ [complete-test] Test no encontrado o no pertenece al usuario:', sessionId)
    return { success: false, status: 'error' }
  }

  // 2. Leer los question_orders ya guardados en test_questions
  //    Necesitamos los orders (no solo el count) para poder identificar
  //    huecos y rellenarlos en la fase de safety-net más abajo.
  const savedOrderRows = await db
    .select({ questionOrder: testQuestions.questionOrder })
    .from(testQuestions)
    .where(eq(testQuestions.testId, sessionId))

  const savedOrders = new Set<number>(savedOrderRows.map(r => r.questionOrder))
  let savedQuestionsCount = savedOrders.size

  // 3. Calcular analytics
  const totalTime = Math.round((Date.now() - startTime) / 1000)
  const avgTimePerQuestion = detailedAnswers.length > 0
    ? Math.round(totalTime / detailedAnswers.length)
    : 0

  const correctAnswers = detailedAnswers.filter(a => a.isCorrect)
  const incorrectAnswers = detailedAnswers.filter(a => !a.isCorrect)

  const difficultyStats: Record<string, DetailedAnswerInput[]> = {
    easy: detailedAnswers.filter(a => a.questionData?.metadata?.difficulty === 'easy'),
    medium: detailedAnswers.filter(a => a.questionData?.metadata?.difficulty === 'medium'),
    hard: detailedAnswers.filter(a => a.questionData?.metadata?.difficulty === 'hard'),
    extreme: detailedAnswers.filter(a => a.questionData?.metadata?.difficulty === 'extreme'),
  }

  const articleStats: Record<string, ArticleStat> = {}
  for (const answer of detailedAnswers) {
    const articleId = answer.questionData?.article?.id
    const articleNumber = answer.questionData?.article?.number
    if (articleId && articleNumber) {
      const key = String(articleNumber)
      if (!articleStats[key]) {
        articleStats[key] = {
          article_id: articleId,
          total: 0,
          correct: 0,
          time_spent: 0,
          law_name: answer.questionData?.article?.law_short_name || 'unknown',
        }
      }
      articleStats[key].total++
      if (answer.isCorrect) articleStats[key].correct++
      articleStats[key].time_spent += answer.timeSpent || 0
    }
  }

  const confidenceAnalysis = {
    very_sure_correct: detailedAnswers.filter(a => a.confidence === 'very_sure' && a.isCorrect).length,
    very_sure_incorrect: detailedAnswers.filter(a => a.confidence === 'very_sure' && !a.isCorrect).length,
    guessing_correct: detailedAnswers.filter(a => a.confidence === 'guessing' && a.isCorrect).length,
    guessing_incorrect: detailedAnswers.filter(a => a.confidence === 'guessing' && !a.isCorrect).length,
  }

  const speedConsistency = avgTimePerQuestion > 0
    ? Math.round((1 - (Math.sqrt(
        detailedAnswers.reduce((sum, a) => sum + Math.pow((a.timeSpent || 0) - avgTimePerQuestion, 2), 0) / detailedAnswers.length
      ) / avgTimePerQuestion)) * 100)
    : 0

  const confidenceAccuracy = detailedAnswers.length > 0
    ? Math.round(((confidenceAnalysis.very_sure_correct + confidenceAnalysis.guessing_incorrect) / detailedAnswers.length) * 100)
    : 0

  const improvementDuringTest = detailedAnswers.length >= 6
    ? detailedAnswers.slice(-3).filter(a => a.isCorrect).length > detailedAnswers.slice(0, 3).filter(a => a.isCorrect).length
    : false

  const interactionEfficiency = detailedAnswers.length > 0
    ? Math.round((detailedAnswers.filter(a => (a.interactions || 1) === 1).length / detailedAnswers.length) * 100)
    : 0

  const learningPatterns = {
    speed_consistency: speedConsistency,
    confidence_accuracy: confidenceAccuracy,
    improvement_during_test: improvementDuringTest,
    interaction_efficiency: interactionEfficiency,
  }

  const detailedAnalytics = {
    performance_summary: {
      accuracy_percentage: Math.round((finalScore / detailedAnswers.length) * 100),
      total_time_minutes: Math.round(totalTime / 60),
      avg_time_per_question: avgTimePerQuestion,
      questions_attempted: detailedAnswers.length,
    },
    difficulty_breakdown: Object.keys(difficultyStats).map(diff => ({
      difficulty: diff,
      total: difficultyStats[diff].length,
      correct: difficultyStats[diff].filter(a => a.isCorrect).length,
      accuracy: difficultyStats[diff].length > 0
        ? Math.round((difficultyStats[diff].filter(a => a.isCorrect).length / difficultyStats[diff].length) * 100)
        : 0,
      avg_time: difficultyStats[diff].length > 0
        ? Math.round(difficultyStats[diff].reduce((sum, a) => sum + (a.timeSpent || 0), 0) / difficultyStats[diff].length)
        : 0,
    })).filter(item => item.total > 0),
    article_performance: Object.keys(articleStats).map(artNum => ({
      article_number: artNum,
      article_id: articleStats[artNum].article_id,
      law_name: articleStats[artNum].law_name,
      total: articleStats[artNum].total,
      correct: articleStats[artNum].correct,
      accuracy: Math.round((articleStats[artNum].correct / articleStats[artNum].total) * 100),
      total_time: articleStats[artNum].time_spent,
      avg_time: Math.round(articleStats[artNum].time_spent / articleStats[artNum].total),
    })),
    time_analysis: {
      fastest_question: detailedAnswers.length > 0 ? Math.min(...detailedAnswers.map(a => a.timeSpent || 0)) : 0,
      slowest_question: detailedAnswers.length > 0 ? Math.max(...detailedAnswers.map(a => a.timeSpent || 0)) : 0,
      avg_correct_time: correctAnswers.length > 0
        ? Math.round(correctAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / correctAnswers.length)
        : 0,
      avg_incorrect_time: incorrectAnswers.length > 0
        ? Math.round(incorrectAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / incorrectAnswers.length)
        : 0,
      time_distribution: detailedAnswers.map(a => a.timeSpent || 0),
    },
    confidence_analysis: confidenceAnalysis,
    learning_patterns: learningPatterns,
    improvement_areas: incorrectAnswers.map(a => ({
      question_order: (a.questionIndex || 0) + 1,
      article_number: a.questionData?.article?.number || 'unknown',
      law_name: a.questionData?.article?.law_short_name || 'unknown',
      difficulty: a.questionData?.metadata?.difficulty || 'unknown',
      time_spent: a.timeSpent || 0,
      confidence: a.confidence || 'unknown',
      interactions: a.interactions || 1,
      priority: a.confidence === 'very_sure' ? 'high'
        : (a.timeSpent || 0) > avgTimePerQuestion * 1.5 ? 'medium' : 'low',
    })),
    session_metadata: {
      device_info: 'server-side',
      total_interactions: interactionEvents.length,
      session_quality: interactionEfficiency > 80 ? 'excellent'
        : interactionEfficiency > 60 ? 'good' : 'needs_improvement',
    },
  }

  const performanceMetrics = {
    completion_rate: 100,
    engagement_score: Math.min(100, interactionEvents.length * 2),
    focus_score: learningPatterns.speed_consistency,
    confidence_calibration: learningPatterns.confidence_accuracy,
    learning_efficiency: Math.round(
      (finalScore / detailedAnswers.length) * (100 / Math.max(1, totalTime / 60))
    ),
  }

  // 4. UPDATE tests
  const now = new Date().toISOString()
  const [updateResult] = await db
    .update(tests)
    .set({
      score: String(finalScore),
      totalQuestions: detailedAnswers.length,
      completedAt: now,
      isCompleted: true,
      totalTimeSeconds: totalTime,
      averageTimePerQuestion: String(avgTimePerQuestion),
      detailedAnalytics: detailedAnalytics,
      performanceMetrics: performanceMetrics,
    })
    .where(and(eq(tests.id, sessionId), eq(tests.userId, userId)))
    .returning({ id: tests.id })

  if (!updateResult) {
    console.error('❌ [complete-test] Error actualizando test:', sessionId)
    return { success: false, status: 'error' }
  }

  // 5. [ELIMINADO 2026-04-15] Update user_progress
  //    Tras auditoría de performance (log Vercel 4093ms en este endpoint)
  //    se verificó que NADIE lee la tabla `user_progress`:
  //    - El código V2 (getUserProgressForTopicV2 en lib/api/topic-data)
  //      deriva todo el progreso desde test_questions filtrando por
  //      article_id vía topic_scope. No consulta user_progress.
  //    - La RPC get_user_progress_trends calcula desde test_questions + tests,
  //      no lee user_progress.
  //    - Ninguna view, trigger u otra RPC del schema public la consume
  //      (verificado con pg_get_functiondef sobre todas las funciones).
  //    - Ningún componente frontend la lee.
  //    Además la lógica antigua era incorrecta para cross-oposición (agregaba
  //    al topic de la primera position_type del loop, no a la del usuario).
  //    Cross-oposición funciona porque test_questions es la fuente de verdad.
  //    Eliminar este paso ahorra 5 SELECT topic + SELECT/UPDATE user_progress
  //    (~600-700ms de round-trips secuenciales Vercel↔Supabase).
  //    La tabla `user_progress` queda sin escrituras nuevas — se puede
  //    eliminar en cleanup futuro o rediseñar si algún consumer la necesita.

  // 6. Update user_sessions si tenemos ID
  if (userSessionId) {
    try {
      await db
        .update(userSessions)
        .set({
          sessionEnd: now,
          totalDurationMinutes: Math.round(totalTime / 60),
          testsCompleted: 1,
          questionsAnswered: detailedAnswers.length,
          questionsCorrect: finalScore,
          sessionOutcome: finalScore >= Math.ceil(detailedAnswers.length * 0.7) ? 'successful' : 'needs_improvement',
          engagementScore: String(Math.min(100, Math.round((interactionEvents.length / detailedAnswers.length) * 10))),
          conversionEvents: ['completed_test'],
        })
        .where(eq(userSessions.id, userSessionId))
    } catch (e) {
      console.warn('⚠️ [complete-test] Error actualizando user_sessions (no-fatal):', e)
    }
  }

  // 7. SAFETY NET: Rellenar huecos en test_questions
  //
  //    Si la cola del cliente (/answer-and-save) no drenó a tiempo antes de
  //    completar el test, algunas respuestas no estarán en test_questions.
  //    Usamos los detailedAnswers del request como fuente de verdad para
  //    rellenar los huecos, garantizando que el test queda con todas sus
  //    filas de respuesta aunque /answer-and-save haya fallado o vaya lento.
  //
  //    Idempotente por ON CONFLICT (test_id, question_order) DO NOTHING.
  //    Escala: 1 SELECT de correctOption por tabla (legislative/psychometric)
  //    + 1 INSERT batch. Complejidad O(1) en round-trips, independiente de N.
  const gapFilledCount = await fillMissingTestQuestions({
    sessionId,
    userId,
    detailedAnswers,
    savedOrders,
    topLevelTema: typeof params.tema === 'number' ? params.tema : null,
    oposicionId: params.oposicionId ?? null,
    deviceInfo: params.deviceInfo ?? null,
  })

  if (gapFilledCount > 0) {
    savedQuestionsCount += gapFilledCount
    console.log(`🛟 [complete-test] Safety-net rellenó ${gapFilledCount} respuestas faltantes en test ${sessionId}`)
  }

  // Si tras el gap-fill siguen faltando filas Y el cliente mandó datos
  // suficientes para insertarlas, es un bug real (no un retraso de cola).
  const expectedRows = detailedAnswers.length
  if (savedQuestionsCount < expectedRows) {
    const missing = expectedRows - savedQuestionsCount
    console.warn(`⚠️ [complete-test] Tras safety-net faltan ${missing}/${expectedRows} respuestas en test ${sessionId} userId=${userId}`)
  }

  console.log(`✅ [complete-test] Test ${sessionId} completado: ${finalScore}/${detailedAnswers.length} (saved: ${savedQuestionsCount}, gapFilled: ${gapFilledCount})`)
  return { success: true, status: 'saved', savedQuestionsCount, gapFilledCount }
}

// ============================================
// HELPER: Safety-net para rellenar respuestas faltantes
// ============================================

interface FillMissingArgs {
  sessionId: string
  userId: string
  detailedAnswers: DetailedAnswerInput[]
  savedOrders: Set<number>
  topLevelTema: number | null
  oposicionId: string | null
  deviceInfo: NonNullable<CompleteTestRequest['deviceInfo']> | null
}

/**
 * Rellena respuestas que el cliente no llegó a guardar via /answer-and-save.
 *
 * Fuente de verdad: los `detailedAnswers` del request. Para cada respuesta
 * cuya `questionOrder` no está en `savedOrders` Y tiene datos mínimos
 * (question + options), reconstruimos el row y lo insertamos via
 * insertTestAnswersBatch con ON CONFLICT DO NOTHING.
 *
 * El `correctAnswer` (índice 0-3) se resuelve consultando la BD — el cliente
 * solo envía `isCorrect: boolean`, no sabemos cuál era la correcta. Una sola
 * query agrupada por tabla (legislative / psychometric) resuelve todos los IDs.
 */
async function fillMissingTestQuestions(args: FillMissingArgs): Promise<number> {
  const { sessionId, userId, detailedAnswers, savedOrders, topLevelTema, oposicionId, deviceInfo } = args
  const db = getDb()

  // 1. Identificar huecos rellenables
  const missing = detailedAnswers.filter(a => {
    const order = (a.questionIndex ?? 0) + 1
    if (savedOrders.has(order)) return false
    const qd = a.questionData
    // Datos mínimos imprescindibles para reconstruir una fila válida
    if (!qd?.question || !qd?.options || qd.options.length < 2) return false
    return true
  })

  if (missing.length === 0) return 0

  // 2. Resolver correctOption batch para todos los IDs
  //    (legislative en `questions`, psychometric en `psychometric_questions`)
  const legIds: string[] = []
  const psyIds: string[] = []
  for (const a of missing) {
    const id = a.questionData?.id
    if (!id) continue
    if (a.questionData?.questionType === 'psychometric') psyIds.push(id)
    else legIds.push(id)
  }

  const correctMap = new Map<string, number>()
  try {
    if (legIds.length > 0) {
      const rows = await db
        .select({ id: questions.id, correctOption: questions.correctOption })
        .from(questions)
        .where(inArray(questions.id, legIds))
      for (const r of rows) {
        if (typeof r.correctOption === 'number') correctMap.set(r.id, r.correctOption)
      }
    }
    if (psyIds.length > 0) {
      const rows = await db
        .select({ id: psychometricQuestions.id, correctOption: psychometricQuestions.correctOption })
        .from(psychometricQuestions)
        .where(inArray(psychometricQuestions.id, psyIds))
      for (const r of rows) {
        if (typeof r.correctOption === 'number') correctMap.set(r.id, r.correctOption)
      }
    }
  } catch (e) {
    console.warn('⚠️ [complete-test gap-fill] Error resolviendo correctOption:', e)
    // Sin correctOption no podemos insertar con datos correctos — abortamos el gap-fill
    return 0
  }

  // 3. Construir SaveAnswerRequest para cada hueco rellenable
  const saveRequests: SaveAnswerRequest[] = []
  for (const a of missing) {
    const id = a.questionData?.id
    if (!id) continue
    const correctOption = correctMap.get(id)
    if (typeof correctOption !== 'number') continue // pregunta desconocida (AI-generated?) → saltar

    const qd = a.questionData!
    const req: SaveAnswerRequest = {
      sessionId,
      questionData: {
        id: id,
        question: qd.question!,
        options: qd.options!,
        tema: qd.tema ?? topLevelTema ?? 0,
        questionType: (qd.questionType as 'legislative' | 'psychometric') ?? 'legislative',
        article: qd.article
          ? {
              id: qd.article.id ?? null,
              number: qd.article.number ?? null,
              law_id: qd.article.law_id ?? null,
              law_short_name: qd.article.law_short_name ?? null,
            }
          : null,
        metadata: qd.metadata
          ? {
              id: qd.id ?? null,
              difficulty: qd.metadata.difficulty ?? null,
              question_type: qd.questionType ?? null,
              tags: qd.metadata.tags ?? null,
            }
          : null,
        explanation: qd.explanation ?? null,
      },
      answerData: {
        questionIndex: a.questionIndex,
        selectedAnswer: a.selectedAnswer,
        correctAnswer: correctOption,
        isCorrect: a.isCorrect,
        timeSpent: a.timeSpent ?? 0,
      },
      tema: topLevelTema ?? 0,
      confidenceLevel: a.confidence ?? 'unknown',
      interactionCount: a.interactions ?? 1,
      questionStartTime: a.questionStartTime ?? 0,
      firstInteractionTime: a.firstInteractionTime ?? 0,
      interactionEvents: [],
      mouseEvents: [],
      scrollEvents: [],
      deviceInfo: deviceInfo ?? undefined,
      oposicionId: oposicionId ?? null,
    }
    saveRequests.push(req)
  }

  if (saveRequests.length === 0) return 0

  // 4. Batch insert idempotente
  const result = await insertTestAnswersBatch(saveRequests, userId)
  if (result.errored) {
    console.error(`❌ [complete-test gap-fill] Batch insert falló: ${result.error}`)
    return 0
  }
  return result.inserted
}

// NOTA: helper updateUserProgress ELIMINADO 2026-04-15.
// Cross-oposición funciona derivando desde test_questions vía
// getUserProgressForTopicV2 + topic_scope. La tabla user_progress
// no se lee en ningún consumer (verificado con pg_get_functiondef
// sobre todas las funciones, views y triggers del schema public).
// Ver histórico git para el código eliminado y contexto completo.

