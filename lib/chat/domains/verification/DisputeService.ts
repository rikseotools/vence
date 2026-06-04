// lib/chat/domains/verification/DisputeService.ts
// Servicio para gestionar impugnaciones de preguntas

// Lecturas por self-hosted PgBouncer (max:8, sano), no Supavisor max:1 → 504.
import { getPoolerDb, getAdminDb } from '@/db/client'
import { questionDisputes, psychometricQuestionDisputes } from '@/db/schema'
import { eq, and, desc, inArray, count } from 'drizzle-orm'
import { logger } from '../../shared/logger'

// Selector de tabla según tipo de pregunta. Ambas tablas comparten las columnas
// que usa este servicio, así que casteamos a una para un único code path.
function disputeTable(isPsychometric?: boolean) {
  return (isPsychometric ? psychometricQuestionDisputes : questionDisputes) as typeof questionDisputes
}

// Columnas que consume mapDisputeFromDb (aliasadas a snake_case)
function disputeCols(t: typeof questionDisputes) {
  return {
    id: t.id,
    question_id: t.questionId,
    user_id: t.userId,
    dispute_type: t.disputeType,
    description: t.description,
    status: t.status,
    admin_response: t.adminResponse,
    created_at: t.createdAt,
    resolved_at: t.resolvedAt,
  }
}

// ============================================
// TIPOS
// ============================================

export type DisputeType = 'no_literal' | 'ai_detected_error' | 'error_pregunta_respuesta' | 'respuesta_incorrecta' | 'desacuerdo_correcta' | 'mal_formulada' | 'pregunta_repetida' | 'explicacion_confusa' | 'explicacion_mejorable' | 'tema_incorrecto' | 'otro'
export type DisputeStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected'

export interface Dispute {
  id: string
  questionId: string
  userId: string | null
  disputeType: DisputeType
  description: string
  status: DisputeStatus
  adminResponse: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface CreateDisputeInput {
  questionId: string
  userId?: string | null
  disputeType: DisputeType
  description: string
  isPsychometric?: boolean // Indica si es una pregunta psicotécnica
  source?: 'user' | 'ai_auto'
  aiChatLogId?: string | null
}

export interface DisputeResult {
  success: boolean
  disputeId?: string
  alreadyExists?: boolean
  error?: string
}

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

/**
 * Crea una impugnación automática por error detectado por IA
 */
export async function createAutoDispute(
  questionId: string,
  aiResponse: string,
  userId?: string | null,
  isPsychometric?: boolean,
  chatLogId?: string | null
): Promise<DisputeResult> {
  try {
    // Determinar el tipo de disputa según la tabla
    // - psychometric_question_disputes permite 'ai_detected_error'
    // - question_disputes solo permite 'no_literal', 'respuesta_incorrecta', 'otro'
    const disputeType: DisputeType = isPsychometric ? 'ai_detected_error' : 'respuesta_incorrecta'

    // Verificar si ya existe una disputa automática para esta pregunta
    const existing = await findExistingDispute(questionId, disputeType, isPsychometric)

    if (existing) {
      logger.debug('Auto-dispute already exists', {
        domain: 'verification',
        questionId,
        disputeId: existing.id,
      })
      return {
        success: true,
        alreadyExists: true,
        disputeId: existing.id,
      }
    }

    // Crear nueva disputa
    const description = `[AUTO-DETECTADO POR IA]\n\n${aiResponse.substring(0, 1000)}`

    const result = await createDispute({
      questionId,
      userId,
      disputeType,
      description,
      isPsychometric,
      source: 'ai_auto',
      aiChatLogId: chatLogId,
    })

    if (result.success) {
      logger.info('Auto-dispute created', {
        domain: 'verification',
        questionId,
        disputeId: result.disputeId,
        isPsychometric,
      })
    }

    return result
  } catch (error) {
    logger.error('Error creating auto-dispute', error, { domain: 'verification' })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Crea una impugnación manual por el usuario
 */
export async function createUserDispute(
  questionId: string,
  userId: string,
  disputeType: DisputeType,
  description: string
): Promise<DisputeResult> {
  try {
    // Verificar si el usuario ya impugnó esta pregunta
    const existing = await findUserDispute(questionId, userId)

    if (existing) {
      logger.debug('User already disputed this question', {
        domain: 'verification',
        questionId,
        userId,
      })
      return {
        success: false,
        alreadyExists: true,
        error: 'Ya has impugnado esta pregunta anteriormente',
      }
    }

    return await createDispute({
      questionId,
      userId,
      disputeType,
      description,
    })
  } catch (error) {
    logger.error('Error creating user dispute', error, { domain: 'verification' })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}

/**
 * Crea una impugnación en la base de datos
 */
async function createDispute(input: CreateDisputeInput): Promise<DisputeResult> {
  // Elegir tabla según tipo de pregunta
  const tableName = input.isPsychometric ? 'psychometric_question_disputes' : 'question_disputes'
  const table = disputeTable(input.isPsychometric)

  const insertData: Record<string, unknown> = {
    questionId: input.questionId,
    userId: input.userId || null,
    disputeType: input.disputeType,
    description: input.description,
    status: 'pending',
    source: input.source || 'user',
  }

  if (input.aiChatLogId) {
    insertData.aiChatLogId = input.aiChatLogId
  }

  const db = getAdminDb()

  try {
    const inserted = await db.insert(table).values(insertData as any).returning({ id: table.id })
    return { success: true, disputeId: inserted[0].id }
  } catch (err: any) {
    // Si falla por FK violation del ai_chat_log_id (race condition: el chat log aún no se insertó),
    // reintentar sin ai_chat_log_id para no perder la disputa
    if (err?.code === '23503' && String(err?.message || '').includes('ai_chat_log_id') && input.aiChatLogId) {
      logger.warn('FK violation on ai_chat_log_id, retrying without it', {
        domain: 'verification',
        table: tableName,
        aiChatLogId: input.aiChatLogId,
      })
      delete insertData.aiChatLogId
      try {
        const retry = await db.insert(table).values(insertData as any).returning({ id: table.id })
        return { success: true, disputeId: retry[0].id }
      } catch (retryErr: any) {
        logger.error('Database error creating dispute (retry)', retryErr, { domain: 'verification', table: tableName })
        return { success: false, error: retryErr?.message || 'Error desconocido' }
      }
    }

    logger.error('Database error creating dispute', err, { domain: 'verification', table: tableName })
    return {
      success: false,
      error: err?.message || 'Error desconocido',
    }
  }
}

// ============================================
// CONSULTAS
// ============================================

/**
 * Busca una disputa existente por tipo
 */
async function findExistingDispute(
  questionId: string,
  disputeType: DisputeType,
  isPsychometric?: boolean
): Promise<Dispute | null> {
  const table = disputeTable(isPsychometric)

  // .single() del código anterior: error (→ null) si 0 o >1 filas; fila si exactamente 1.
  const rows = await getAdminDb()
    .select(disputeCols(table))
    .from(table)
    .where(and(eq(table.questionId, questionId), eq(table.disputeType, disputeType)))
    .limit(2)

  if (rows.length !== 1) {
    return null
  }

  return mapDisputeFromDb(rows[0])
}

/**
 * Busca una disputa del usuario para una pregunta
 */
async function findUserDispute(
  questionId: string,
  userId: string,
  isPsychometric?: boolean
): Promise<Dispute | null> {
  const table = disputeTable(isPsychometric)

  // .single() del código anterior: error (→ null) si 0 o >1 filas; fila si exactamente 1.
  const rows = await getAdminDb()
    .select(disputeCols(table))
    .from(table)
    .where(and(eq(table.questionId, questionId), eq(table.userId, userId)))
    .limit(2)

  if (rows.length !== 1) {
    return null
  }

  return mapDisputeFromDb(rows[0])
}

/**
 * Obtiene todas las disputas de una pregunta
 */
export async function getDisputesForQuestion(questionId: string): Promise<Dispute[]> {
  try {
    const rows = await getPoolerDb()
      .select(disputeCols(questionDisputes))
      .from(questionDisputes)
      .where(eq(questionDisputes.questionId, questionId))
      .orderBy(desc(questionDisputes.createdAt))
    return rows.map(mapDisputeFromDb)
  } catch {
    return []
  }
}

/**
 * Obtiene las disputas pendientes de un usuario
 */
export async function getUserPendingDisputes(userId: string): Promise<Dispute[]> {
  try {
    const rows = await getPoolerDb()
      .select(disputeCols(questionDisputes))
      .from(questionDisputes)
      .where(and(eq(questionDisputes.userId, userId), eq(questionDisputes.status, 'pending')))
      .orderBy(desc(questionDisputes.createdAt))
    return rows.map(mapDisputeFromDb)
  } catch {
    return []
  }
}

/**
 * Verifica si una pregunta tiene disputas pendientes
 */
export async function hasOpenDisputes(questionId: string): Promise<boolean> {
  try {
    const rows = await getPoolerDb()
      .select({ c: count() })
      .from(questionDisputes)
      .where(and(
        eq(questionDisputes.questionId, questionId),
        inArray(questionDisputes.status, ['pending', 'reviewing']),
      ))
    return Number(rows[0]?.c ?? 0) > 0
  } catch {
    return false
  }
}

// ============================================
// ESTADÍSTICAS
// ============================================

export interface DisputeStats {
  total: number
  pending: number
  resolved: number
  rejected: number
  byType: Record<DisputeType, number>
}

/**
 * Obtiene estadísticas de disputas para una pregunta
 */
export async function getDisputeStats(questionId: string): Promise<DisputeStats> {
  const disputes = await getDisputesForQuestion(questionId)

  const stats: DisputeStats = {
    total: disputes.length,
    pending: 0,
    resolved: 0,
    rejected: 0,
    byType: {
      no_literal: 0,
      ai_detected_error: 0,
      error_pregunta_respuesta: 0,
      respuesta_incorrecta: 0,
      desacuerdo_correcta: 0,
      mal_formulada: 0,
      pregunta_repetida: 0,
      explicacion_confusa: 0,
      explicacion_mejorable: 0,
      tema_incorrecto: 0,
      otro: 0,
    },
  }

  for (const dispute of disputes) {
    // Contar por estado
    if (dispute.status === 'pending' || dispute.status === 'reviewing') {
      stats.pending++
    } else if (dispute.status === 'resolved') {
      stats.resolved++
    } else if (dispute.status === 'rejected') {
      stats.rejected++
    }

    // Contar por tipo
    if (dispute.disputeType in stats.byType) {
      stats.byType[dispute.disputeType]++
    }
  }

  return stats
}

// ============================================
// HELPERS
// ============================================

function mapDisputeFromDb(data: any): Dispute {
  return {
    id: data.id,
    questionId: data.question_id,
    userId: data.user_id,
    disputeType: data.dispute_type,
    description: data.description,
    status: data.status,
    adminResponse: data.admin_response,
    createdAt: data.created_at,
    resolvedAt: data.resolved_at,
  }
}

/**
 * Genera el mensaje de confirmación de impugnación
 */
export function generateDisputeConfirmationMessage(isAuto: boolean): string {
  if (isAuto) {
    return '\n\n---\n📋 **He impugnado esta pregunta automáticamente y la he enviado a Soporte para revisión.**'
  }

  return '\n\n---\n📋 **Tu impugnación ha sido enviada a Soporte para revisión.**'
}
