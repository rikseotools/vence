// lib/api/v2/answer-and-save/queries.ts
// Lógica server-side: validar respuesta + guardar + actualizar score
import { getDb } from '@/db/client'
import { tests, userProfiles, questions, articles, laws, psychometricQuestions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { insertTestAnswer } from '@/lib/api/test-answers'
import type { SaveAnswerRequest } from '@/lib/api/test-answers'
import type { AnswerAndSaveRequest, AnswerAndSaveResponse } from './schemas'

// ============================================
// VALIDAR + GUARDAR (operación principal)
// ============================================

export async function validateAndSaveAnswer(
  params: AnswerAndSaveRequest,
  userId: string,
): Promise<AnswerAndSaveResponse> {
  const db = getDb()

  // 1. VALIDAR RESPUESTA (misma lógica que /api/answer)
  let correctOption: number | null = null
  let explanation: string | null = null
  let articleNumber: string | null = null
  let lawShortName: string | null = null
  let lawName: string | null = null

  const result = await db
    .select({
      correctOption: questions.correctOption,
      explanation: questions.explanation,
      articleNumber: articles.articleNumber,
      lawShortName: laws.shortName,
      lawName: laws.name,
    })
    .from(questions)
    .leftJoin(articles, eq(questions.primaryArticleId, articles.id))
    .leftJoin(laws, eq(articles.lawId, laws.id))
    .where(eq(questions.id, params.questionId))
    .limit(1)

  if (result[0]) {
    correctOption = result[0].correctOption
    explanation = result[0].explanation
    articleNumber = result[0].articleNumber
    lawShortName = result[0].lawShortName
    lawName = result[0].lawName
  } else {
    // Intentar en psychometric_questions
    const psyResult = await db
      .select({
        correctOption: psychometricQuestions.correctOption,
        explanation: psychometricQuestions.explanation,
      })
      .from(psychometricQuestions)
      .where(eq(psychometricQuestions.id, params.questionId))
      .limit(1)

    if (psyResult[0]) {
      correctOption = psyResult[0].correctOption
      explanation = psyResult[0].explanation
    }
  }

  if (correctOption === null) {
    return {
      success: false,
      isCorrect: false,
      correctAnswer: 0,
      explanation: null,
      newScore: params.currentScore,
      saveAction: 'save_failed',
    }
  }

  const isCorrect = params.userAnswer === correctOption
  const newScore = isCorrect ? params.currentScore + 1 : params.currentScore

  // 2. GUARDAR EN test_questions (reusar insertTestAnswer existente)
  const saveRequest: SaveAnswerRequest = {
    sessionId: params.sessionId,
    questionData: {
      id: params.questionId,
      question: params.questionText,
      options: params.options,
      tema: params.tema,
      questionType: params.questionType,
      article: params.article,
      metadata: params.metadata,
      explanation: params.explanation,
    },
    answerData: {
      questionIndex: params.questionIndex,
      selectedAnswer: params.userAnswer,
      correctAnswer: correctOption,
      isCorrect,
      timeSpent: params.timeSpent,
    },
    tema: params.tema,
    confidenceLevel: params.confidenceLevel,
    interactionCount: params.interactionCount,
    questionStartTime: params.questionStartTime,
    firstInteractionTime: params.firstInteractionTime,
    interactionEvents: params.interactionEvents as unknown[],
    mouseEvents: params.mouseEvents as unknown[],
    scrollEvents: params.scrollEvents as unknown[],
    deviceInfo: params.deviceInfo,
    oposicionId: params.oposicionId,
  }

  const saveResult = await insertTestAnswer(saveRequest, userId)

  // 3. ACTUALIZAR SCORE (solo si se guardó bien)
  if (saveResult.success) {
    try {
      await db
        .update(tests)
        .set({ score: String(newScore) })
        .where(eq(tests.id, params.sessionId))
    } catch (scoreError) {
      console.error('⚠️ [answer-and-save] Error actualizando score:', scoreError)
      // No fallar por esto — la respuesta se validó y guardó
    }
  }

  return {
    success: true,
    isCorrect,
    correctAnswer: correctOption,
    explanation,
    articleNumber,
    lawShortName,
    lawName,
    newScore,
    saveAction: saveResult.success
      ? (saveResult.action as 'saved_new' | 'already_saved')
      : 'save_failed',
    questionDbId: saveResult.question_id ?? null,
  }
}

// ============================================
// OPERACIONES BACKGROUND (para after())
// ============================================

export async function markActiveStudentIfFirst(userId: string): Promise<void> {
  try {
    const db = getDb()
    const result = await db
      .select({ isActiveStudent: userProfiles.isActiveStudent })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    if (result[0] && !result[0].isActiveStudent) {
      await db
        .update(userProfiles)
        .set({
          isActiveStudent: true,
          firstTestCompletedAt: new Date().toISOString(),
        })
        .where(eq(userProfiles.id, userId))
      console.log('🎯 [after] Usuario marcado como ACTIVO:', userId)
    }
  } catch (error) {
    console.warn('⚠️ [after] Error marcando is_active_student:', error)
  }
}
