// lib/api/dispute/queries.ts - Queries tipadas para impugnaciones de preguntas
import { getDb } from '@/db/client'
import { questionDisputes, questions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { CreateDisputeResponse, DisputeData } from './schemas'

// ============================================
// CREAR IMPUGNACIÓN
// ============================================

export async function createDispute(
  questionId: string,
  userId: string,
  disputeType: string,
  description: string
): Promise<CreateDisputeResponse> {
  try {
    const db = getDb()

    // Verificar que la pregunta existe
    const [question] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1)

    if (!question) {
      return { success: false, error: 'Pregunta no encontrada' }
    }

    // Verificar que el usuario no haya impugnado ya esta pregunta
    const [existing] = await db
      .select({ id: questionDisputes.id })
      .from(questionDisputes)
      .where(
        and(
          eq(questionDisputes.questionId, questionId),
          eq(questionDisputes.userId, userId)
        )
      )
      .limit(1)

    if (existing) {
      return { success: false, error: 'Ya has impugnado esta pregunta anteriormente' }
    }

    // Insertar la impugnación
    const [dispute] = await db
      .insert(questionDisputes)
      .values({
        questionId,
        userId,
        disputeType,
        description,
        status: 'pending',
      })
      .returning({
        id: questionDisputes.id,
        questionId: questionDisputes.questionId,
        userId: questionDisputes.userId,
        disputeType: questionDisputes.disputeType,
        description: questionDisputes.description,
        status: questionDisputes.status,
        createdAt: questionDisputes.createdAt,
      })

    if (!dispute) {
      return { success: false, error: 'No se pudo crear la impugnación' }
    }

    console.log('✅ [Dispute] Impugnación creada:', {
      id: dispute.id,
      questionId: dispute.questionId,
      disputeType: dispute.disputeType,
    })

    return {
      success: true,
      data: dispute as DisputeData,
    }
  } catch (error: unknown) {
    console.error('❌ [Dispute] Error creando impugnación:', error)

    // Detectar constraint violation (duplicate)
    if (
      error instanceof Error &&
      (error.message.includes('duplicate key') ||
        error.message.includes('question_disputes_question_id_user_id_key'))
    ) {
      return {
        success: false,
        error: 'Ya has impugnado esta pregunta anteriormente',
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
