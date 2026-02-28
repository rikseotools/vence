// lib/api/psychometric-answer/queries.ts
// Query unificada: validar respuesta + guardar + actualizar sesión
// Todo en una sola operación para máxima fiabilidad en conexiones inestables

import { getDb } from '@/db/client'
import { psychometricQuestions, psychometricTestAnswers, psychometricTestSessions } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { PsychometricAnswerRequest, PsychometricAnswerResponse } from './schemas'

type AnswerResult =
  | PsychometricAnswerResponse
  | { success: false; error: string }

export async function validateAndSavePsychometricAnswer(
  params: PsychometricAnswerRequest
): Promise<AnswerResult> {
  const db = getDb()

  // 1. Obtener respuesta correcta
  const result = await db
    .select({
      correctOption: psychometricQuestions.correctOption,
      explanation: psychometricQuestions.explanation,
      solutionSteps: psychometricQuestions.solutionSteps,
    })
    .from(psychometricQuestions)
    .where(eq(psychometricQuestions.id, params.questionId))
    .limit(1)

  const question = result[0]

  if (!question || question.correctOption === null) {
    console.error('❌ [API/psychometric-answer] Pregunta no encontrada:', params.questionId)
    return { success: false, error: 'Pregunta no encontrada' }
  }

  const isCorrect = params.userAnswer === question.correctOption

  console.log('✅ [API/psychometric-answer] Validada:', {
    questionId: params.questionId,
    userAnswer: params.userAnswer,
    correctAnswer: question.correctOption,
    isCorrect,
  })

  // 2. Si hay sessionId + userId, guardar respuesta y actualizar sesión
  let saved = false
  let sessionProgress: PsychometricAnswerResponse['sessionProgress'] = null

  if (params.sessionId && params.userId) {
    try {
      // Insertar respuesta
      await db.insert(psychometricTestAnswers).values({
        testSessionId: params.sessionId,
        userId: params.userId,
        questionId: params.questionId,
        questionOrder: params.questionOrder ?? 1,
        userAnswer: params.userAnswer,
        isCorrect,
        timeSpentSeconds: params.timeSpentSeconds ?? 0,
        questionSubtype: params.questionSubtype ?? null,
      })

      // Actualizar sesión con SQL atómico (increment, no read-then-write)
      const updated = await db
        .update(psychometricTestSessions)
        .set({
          questionsAnswered: sql`COALESCE(${psychometricTestSessions.questionsAnswered}, 0) + 1`,
          correctAnswers: isCorrect
            ? sql`COALESCE(${psychometricTestSessions.correctAnswers}, 0) + 1`
            : sql`COALESCE(${psychometricTestSessions.correctAnswers}, 0)`,
          accuracyPercentage: sql`
            ROUND(
              (COALESCE(${psychometricTestSessions.correctAnswers}, 0)${isCorrect ? sql` + 1` : sql``})::numeric
              / (COALESCE(${psychometricTestSessions.questionsAnswered}, 0) + 1)
              * 100,
              2
            )
          `,
        })
        .where(eq(psychometricTestSessions.id, params.sessionId))
        .returning({
          questionsAnswered: psychometricTestSessions.questionsAnswered,
          correctAnswers: psychometricTestSessions.correctAnswers,
          accuracyPercentage: psychometricTestSessions.accuracyPercentage,
        })

      saved = true

      if (updated[0]) {
        sessionProgress = {
          questionsAnswered: updated[0].questionsAnswered ?? 0,
          correctAnswers: updated[0].correctAnswers ?? 0,
          accuracyPercentage: Number(updated[0].accuracyPercentage ?? 0),
        }
      }

      console.log('✅ [API/psychometric-answer] Guardado:', sessionProgress)
    } catch (saveError) {
      // Guardar falló pero la validación sí funcionó — devolver resultado igualmente
      console.error('❌ [API/psychometric-answer] Error guardando:', saveError)
      saved = false
    }
  }

  return {
    success: true,
    isCorrect,
    correctAnswer: question.correctOption,
    explanation: question.explanation,
    solutionSteps: question.solutionSteps,
    saved,
    sessionProgress,
  }
}
