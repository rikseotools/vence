// lib/chat/domains/verification/DisputeService.ts
// Servicio para gestionar impugnaciones de preguntas

import { createClient } from '@supabase/supabase-js'
import { logger } from '../../shared/logger'

// Cliente Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ============================================
// TIPOS
// ============================================

export type DisputeType = 'ai_detected_error' | 'no_literal' | 'respuesta_incorrecta' | 'otro'
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
  isPsychometric?: boolean
): Promise<DisputeResult> {
  try {
    // Verificar si ya existe una disputa automática para esta pregunta
    const existing = await findExistingDispute(questionId, 'ai_detected_error', isPsychometric)

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
      disputeType: 'ai_detected_error',
      description,
      isPsychometric,
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

  const { data, error } = await supabase
    .from(tableName)
    .insert({
      question_id: input.questionId,
      user_id: input.userId || null,
      dispute_type: input.disputeType,
      description: input.description,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    logger.error('Database error creating dispute', error, { domain: 'verification', table: tableName })
    return {
      success: false,
      error: error.message,
    }
  }

  return {
    success: true,
    disputeId: data.id,
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
  const tableName = isPsychometric ? 'psychometric_question_disputes' : 'question_disputes'

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('question_id', questionId)
    .eq('dispute_type', disputeType)
    .single()

  if (error || !data) {
    return null
  }

  return mapDisputeFromDb(data)
}

/**
 * Busca una disputa del usuario para una pregunta
 */
async function findUserDispute(
  questionId: string,
  userId: string,
  isPsychometric?: boolean
): Promise<Dispute | null> {
  const tableName = isPsychometric ? 'psychometric_question_disputes' : 'question_disputes'

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('question_id', questionId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return mapDisputeFromDb(data)
}

/**
 * Obtiene todas las disputas de una pregunta
 */
export async function getDisputesForQuestion(questionId: string): Promise<Dispute[]> {
  const { data, error } = await supabase
    .from('question_disputes')
    .select('*')
    .eq('question_id', questionId)
    .order('created_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data.map(mapDisputeFromDb)
}

/**
 * Obtiene las disputas pendientes de un usuario
 */
export async function getUserPendingDisputes(userId: string): Promise<Dispute[]> {
  const { data, error } = await supabase
    .from('question_disputes')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error || !data) {
    return []
  }

  return data.map(mapDisputeFromDb)
}

/**
 * Verifica si una pregunta tiene disputas pendientes
 */
export async function hasOpenDisputes(questionId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('question_disputes')
    .select('*', { count: 'exact', head: true })
    .eq('question_id', questionId)
    .in('status', ['pending', 'reviewing'])

  if (error) {
    return false
  }

  return (count || 0) > 0
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
      ai_detected_error: 0,
      no_literal: 0,
      respuesta_incorrecta: 0,
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
