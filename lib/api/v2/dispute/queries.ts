// lib/api/v2/dispute/queries.ts
// Queries Drizzle unificadas para impugnaciones (legislativas y psicotécnicas)

import { getDb } from '@/db/client'
import {
  questionDisputes,
  psychometricQuestionDisputes,
  questions,
  psychometricQuestions,
} from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type {
  QuestionType,
  CreateDisputeRequest,
  CreateDisputeResponse,
  GetDisputeResponse,
  ExistingDispute,
  DisputeError,
} from './schemas'

/**
 * Obtiene una impugnación existente del usuario para una pregunta.
 */
export async function getExistingDispute(
  questionId: string,
  userId: string,
  questionType: QuestionType
): Promise<GetDisputeResponse | DisputeError> {
  try {
    const db = getDb()

    if (questionType === 'psychometric') {
      const [existing] = await db
        .select({
          id: psychometricQuestionDisputes.id,
          status: psychometricQuestionDisputes.status,
          disputeType: psychometricQuestionDisputes.disputeType,
          description: psychometricQuestionDisputes.description,
          adminResponse: psychometricQuestionDisputes.adminResponse,
          createdAt: psychometricQuestionDisputes.createdAt,
          resolvedAt: psychometricQuestionDisputes.resolvedAt,
        })
        .from(psychometricQuestionDisputes)
        .where(
          and(
            eq(psychometricQuestionDisputes.questionId, questionId),
            eq(psychometricQuestionDisputes.userId, userId)
          )
        )
        .limit(1)

      return {
        success: true,
        dispute: existing ? {
          id: existing.id,
          status: existing.status,
          disputeType: existing.disputeType,
          description: existing.description,
          adminResponse: existing.adminResponse,
          createdAt: existing.createdAt,
          resolvedAt: existing.resolvedAt,
        } : null,
      }
    } else {
      const [existing] = await db
        .select({
          id: questionDisputes.id,
          status: questionDisputes.status,
          disputeType: questionDisputes.disputeType,
          description: questionDisputes.description,
          adminResponse: questionDisputes.adminResponse,
          createdAt: questionDisputes.createdAt,
          resolvedAt: questionDisputes.resolvedAt,
        })
        .from(questionDisputes)
        .where(
          and(
            eq(questionDisputes.questionId, questionId),
            eq(questionDisputes.userId, userId)
          )
        )
        .limit(1)

      return {
        success: true,
        dispute: existing ? {
          id: existing.id,
          status: existing.status,
          disputeType: existing.disputeType,
          description: existing.description,
          adminResponse: existing.adminResponse,
          createdAt: existing.createdAt,
          resolvedAt: existing.resolvedAt,
        } : null,
      }
    }
  } catch (error) {
    console.error('Error obteniendo impugnacion existente:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

/**
 * Crea una nueva impugnación. Verifica que la pregunta existe y no hay duplicado.
 */
export async function createDispute(
  params: CreateDisputeRequest,
  userId: string
): Promise<CreateDisputeResponse | DisputeError> {
  try {
    const db = getDb()
    const { questionId, questionType, disputeType, description } = params

    // 1. Verificar que la pregunta existe
    if (questionType === 'psychometric') {
      const [question] = await db
        .select({ id: psychometricQuestions.id })
        .from(psychometricQuestions)
        .where(eq(psychometricQuestions.id, questionId))
        .limit(1)

      if (!question) {
        return { success: false, error: 'Pregunta psicotecnica no encontrada' }
      }
    } else {
      const [question] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1)

      if (!question) {
        return { success: false, error: 'Pregunta no encontrada' }
      }
    }

    // 2. Verificar duplicado
    const existingResult = await getExistingDispute(questionId, userId, questionType)
    if ('dispute' in existingResult && existingResult.dispute) {
      return { success: false, error: 'Ya has impugnado esta pregunta anteriormente' }
    }

    // 3. Insertar
    if (questionType === 'psychometric') {
      const [result] = await db
        .insert(psychometricQuestionDisputes)
        .values({
          questionId,
          userId,
          disputeType,
          description,
          status: 'pending',
          source: 'user',
        })
        .returning({ id: psychometricQuestionDisputes.id })

      if (!result?.id) {
        return { success: false, error: 'Error creando impugnacion' }
      }

      console.log(`\u2705 [Dispute] Psicotecnica creada: ${result.id}`)
      return { success: true, disputeId: result.id }
    } else {
      const [result] = await db
        .insert(questionDisputes)
        .values({
          questionId,
          userId,
          disputeType,
          description,
          status: 'pending',
          source: 'user',
        })
        .returning({ id: questionDisputes.id })

      if (!result?.id) {
        return { success: false, error: 'Error creando impugnacion' }
      }

      console.log(`\u2705 [Dispute] Legislativa creada: ${result.id}`)
      return { success: true, disputeId: result.id }
    }
  } catch (error) {
    console.error('Error creando impugnacion:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}
