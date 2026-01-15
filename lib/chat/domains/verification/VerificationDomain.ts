// lib/chat/domains/verification/VerificationDomain.ts
// Dominio de verificación de respuestas para el chat

import type { ChatDomain, ChatContext, ChatResponse, ArticleSource } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { logger } from '../../shared/logger'
import { DOMAIN_PRIORITIES } from '../../core/types'
import {
  verifyAnswer,
  isVerificationRequest,
  hasQuestionToVerify,
  extractVerificationInput,
} from './VerificationService'

// ============================================
// DOMINIO DE VERIFICACIÓN
// ============================================

export class VerificationDomain implements ChatDomain {
  name = 'verification'
  priority = DOMAIN_PRIORITIES.VERIFICATION // Máxima prioridad

  /**
   * Determina si este dominio puede manejar el contexto
   */
  async canHandle(context: ChatContext): Promise<boolean> {
    const qc = context.questionContext

    // Debug: ver qué tenemos
    logger.info('VerificationDomain.canHandle check', {
      domain: 'verification',
      hasQC: !!qc,
      questionText: qc?.questionText?.substring(0, 50),
      correctAnswer: qc?.correctAnswer,
      correctAnswerType: typeof qc?.correctAnswer,
      message: context.currentMessage?.substring(0, 50),
    })

    // Necesitamos contexto de pregunta para verificar
    if (!hasQuestionToVerify(context)) {
      logger.info('VerificationDomain: hasQuestionToVerify = false', { domain: 'verification' })
      return false
    }

    // Verificar si el mensaje es una solicitud de verificación
    const isVerification = isVerificationRequest(context.currentMessage)

    // También manejar si el usuario pregunta sobre la respuesta
    const asksAboutAnswer = this.asksAboutAnswer(context.currentMessage)

    logger.info('VerificationDomain pattern check', {
      domain: 'verification',
      isVerification,
      asksAboutAnswer,
    })

    if (isVerification || asksAboutAnswer) {
      logger.debug('VerificationDomain will handle request', {
        domain: 'verification',
        isVerification,
        asksAboutAnswer,
      })
      return true
    }

    return false
  }

  /**
   * Procesa el contexto y genera una respuesta
   */
  async handle(context: ChatContext): Promise<ChatResponse> {
    const startTime = Date.now()

    logger.info('VerificationDomain handling request', {
      domain: 'verification',
      userId: context.userId,
      questionId: context.questionContext?.questionId,
    })

    // Extraer datos de verificación
    const input = extractVerificationInput(context)

    if (!input) {
      return new ChatResponseBuilder()
        .domain('verification')
        .text('No tengo suficiente información sobre la pregunta para verificarla.')
        .processingTime(Date.now() - startTime)
        .build()
    }

    // Realizar verificación
    const result = await verifyAnswer(input, context)

    // Construir respuesta
    const builder = new ChatResponseBuilder()
      .domain('verification')
      .text(result.response)
      .processingTime(Date.now() - startTime)

    // Añadir fuentes a metadata (sin mostrar al usuario)
    if (result.sources.length > 0) {
      builder.addSources(result.sources)
      // NO llamamos .withSourcesBlock() para no mostrar fuentes al usuario
    }

    // Añadir metadata de verificación
    if (result.errorDetected) {
      builder.verification({
        isCorrect: false,
        correctAnswer: result.errorDetails?.details ? undefined : input.markedCorrect,
        explanation: result.errorDetails?.details,
      })
    } else {
      builder.verification({
        isCorrect: true,
        correctAnswer: input.markedCorrect,
      })
    }

    return builder.build()
  }

  /**
   * Detecta si el usuario pregunta sobre la respuesta
   */
  private asksAboutAnswer(message: string): boolean {
    const patterns = [
      /por\s*qu[eé]/i,
      /c[oó]mo\s+se\s+llega/i,
      /expl[ií]ca/i,
      /no\s+entiendo/i,
      /cu[aá]l\s+es\s+la\s+(correcta|respuesta)/i,
      /d[oó]nde\s+viene/i,
      /qu[eé]\s+art[ií]culo/i,
      /en\s+qu[eé]\s+(ley|art[ií]culo)/i,
    ]

    return patterns.some(p => p.test(message))
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

let verificationDomainInstance: VerificationDomain | null = null

export function getVerificationDomain(): VerificationDomain {
  if (!verificationDomainInstance) {
    verificationDomainInstance = new VerificationDomain()
  }
  return verificationDomainInstance
}
