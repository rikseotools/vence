// lib/chat/domains/psychometric/PsychometricDomain.ts
// Dominio de psicotécnicos para el chat

import type { ChatDomain, ChatContext, ChatResponse, AITracerInterface } from '../../core/types'
import { DOMAIN_PRIORITIES } from '../../core/types'
import { isPsychometricSubtype } from '../../shared/constants'
import { logger } from '../../shared/logger'
import { processPsychometricQuestion } from './PsychometricService'

/**
 * Dominio especializado para preguntas psicotécnicas.
 *
 * Maneja:
 * - Series numéricas, alfabéticas y alfanuméricas (con validación matemática)
 * - Gráficos de barras, circulares, lineales y mixtos
 * - Tablas de datos
 * - Detección de errores ortográficos
 * - Análisis de palabras
 *
 * Prioridad 1.5: se evalúa después de Verification (1) pero antes de
 * Knowledge Base (2), ya que las preguntas psicotécnicas son fácilmente
 * identificables por su subtipo y necesitan un pipeline especializado.
 */
export class PsychometricDomain implements ChatDomain {
  name = 'psychometric'
  priority = DOMAIN_PRIORITIES.PSYCHOMETRIC

  /**
   * Determina si el contexto contiene una pregunta psicotécnica.
   * Usa el questionSubtype del contexto de pregunta.
   */
  async canHandle(context: ChatContext): Promise<boolean> {
    const subtype = context.questionContext?.questionSubtype
    const canHandle = isPsychometricSubtype(subtype)

    if (canHandle) {
      logger.debug(`PsychometricDomain will handle: subtype=${subtype}`, {
        domain: 'psychometric',
      })
    }

    return canHandle
  }

  /**
   * Procesa la pregunta psicotécnica con validación y prompt especializado
   */
  async handle(context: ChatContext, tracer?: AITracerInterface): Promise<ChatResponse> {
    return processPsychometricQuestion(context, tracer)
  }
}

// Singleton
let psychometricDomainInstance: PsychometricDomain | null = null

export function getPsychometricDomain(): PsychometricDomain {
  if (!psychometricDomainInstance) {
    psychometricDomainInstance = new PsychometricDomain()
  }
  return psychometricDomainInstance
}
