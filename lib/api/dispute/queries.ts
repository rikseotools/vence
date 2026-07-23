// lib/api/dispute/queries.ts - Queries tipadas para impugnaciones de preguntas
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getDisputeDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { questionDisputes, questions, testQuestions } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { emitFireAndForget } from '@/lib/observability/emit'
import type { CreateDisputeResponse, DisputeData, GetExistingDisputeResponse, AppealDisputeResponse } from './schemas'

// ============================================
// OBTENER IMPUGNACIÓN EXISTENTE
// ============================================

export async function getExistingDispute(
  questionId: string,
  userId: string
): Promise<GetExistingDisputeResponse> {
  try {
    const db = getDisputeDb()

    const [dispute] = await db
      .select({
        id: questionDisputes.id,
        disputeType: questionDisputes.disputeType,
        status: questionDisputes.status,
        createdAt: questionDisputes.createdAt,
        adminResponse: questionDisputes.adminResponse,
      })
      .from(questionDisputes)
      .where(
        and(
          eq(questionDisputes.questionId, questionId),
          eq(questionDisputes.userId, userId),
          inArray(questionDisputes.status, ['pending', 'reviewing'])
        )
      )
      .limit(1)

    return { success: true, data: dispute ?? null }
  } catch (error: unknown) {
    console.error('❌ [Dispute] Error obteniendo impugnación existente:', error)
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

// ============================================
// RED DE SEGURIDAD — engagement de impugnación (observable, no bloqueante)
// ============================================

/**
 * Emite un warn (`dispute_question_not_engaged`) si el usuario impugna una pregunta que NO ha
 * respondido (sin fila en `test_questions`). Defensa en profundidad frente a mala atribución
 * (bug 21/07). Se llama SIN await desde createDispute (fuera del path de latencia); devuelve la
 * promesa solo para poder await-earla en tests. Nunca lanza (best-effort).
 *
 * ALCANCE: cubre el path v1 (`/api/dispute`, usado por FeedbackModal) — donde ocurrió el
 * incidente. El path inline v2 (`QuestionDispute` → `/api/v2/dispute`) pasa el questionId
 * explícito (correcto por construcción), así que no lleva este guard.
 */
export async function checkDisputeEngagement(
  userId: string,
  questionId: string,
  disputeType: string,
): Promise<void> {
  try {
    const db = getDisputeDb()
    const [engaged] = await db
      .select({ id: testQuestions.id })
      .from(testQuestions)
      .where(and(eq(testQuestions.userId, userId), eq(testQuestions.questionId, questionId)))
      .limit(1)
    if (!engaged) {
      emitFireAndForget({
        source: 'fargate',
        severity: 'warn',
        eventType: 'dispute_question_not_engaged',
        endpoint: '/api/dispute',
        userId,
        metadata: { questionId, disputeType, reason: 'no_test_questions_row' },
      })
    }
  } catch {
    // best-effort: si la consulta falla, no afecta a la creación de la impugnación.
  }
}

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
    const db = getDisputeDb()

    // Verificar que la pregunta existe
    const [question] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1)

    if (!question) {
      return { success: false, error: 'Pregunta no encontrada' }
    }

    // 🛡️ RED DE SEGURIDAD (defensa en profundidad, NO bloqueante): una impugnación debería ser
    // de una pregunta que el usuario ha RESPONDIDO. Si no hay fila en test_questions para
    // (user, question), es sospechoso de mala atribución (el bug del 21/07 colgó una impugnación
    // de una pregunta que la usuaria nunca respondió). No bloqueamos —para no romper casos
    // legítimos sin rastro— y va DESACOPLADO del path de latencia (este endpoint tiene historial
    // de 504 por el pooler; no le sumamos un round-trip serial). Solo emite; su resultado no se
    // usa. El fix de raíz está en el cliente (resolveQuestionId): esto es la red por si se cuela.
    checkDisputeEngagement(userId, questionId, disputeType)

    // Verificar que el usuario no tenga una impugnación activa (pending/reviewing)
    const [existing] = await db
      .select({ id: questionDisputes.id })
      .from(questionDisputes)
      .where(
        and(
          eq(questionDisputes.questionId, questionId),
          eq(questionDisputes.userId, userId),
          inArray(questionDisputes.status, ['pending', 'reviewing'])
        )
      )
      .limit(1)

    if (existing) {
      return { success: false, error: 'Ya tienes una impugnación activa para esta pregunta' }
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

// ============================================
// APELAR / ACEPTAR RESOLUCIÓN
// ============================================

export async function handleDisputeAppeal(
  disputeId: string,
  userId: string,
  action: 'accept' | 'appeal',
  appealText?: string
): Promise<AppealDisputeResponse> {
  try {
    const db = getDisputeDb()

    // Verificar que la disputa pertenece al usuario
    const [dispute] = await db
      .select({ id: questionDisputes.id, status: questionDisputes.status })
      .from(questionDisputes)
      .where(
        and(
          eq(questionDisputes.id, disputeId),
          eq(questionDisputes.userId, userId)
        )
      )
      .limit(1)

    if (!dispute) {
      return { success: false, error: 'Impugnación no encontrada' }
    }

    if (dispute.status !== 'resolved' && dispute.status !== 'rejected') {
      return { success: false, error: 'Solo puedes responder a impugnaciones resueltas o rechazadas' }
    }

    if (action === 'accept') {
      await db
        .update(questionDisputes)
        .set({
          appealText: 'Usuario de acuerdo con la respuesta del administrador.',
          appealSubmittedAt: new Date().toISOString(),
        })
        .where(eq(questionDisputes.id, disputeId))
    } else {
      if (!appealText?.trim()) {
        return { success: false, error: 'El texto de apelación es requerido' }
      }
      await db
        .update(questionDisputes)
        .set({
          status: 'pending',
          appealText: appealText.trim(),
          appealSubmittedAt: new Date().toISOString(),
        })
        .where(eq(questionDisputes.id, disputeId))
    }

    return { success: true }
  } catch (error: unknown) {
    console.error('❌ [Dispute] Error procesando apelación:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
