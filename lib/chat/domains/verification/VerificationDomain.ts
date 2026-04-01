// lib/chat/domains/verification/VerificationDomain.ts
// Dominio de verificación de respuestas para el chat

import type { ChatDomain, ChatContext, ChatResponse, ArticleSource, AITracerInterface } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { logger } from '../../shared/logger'
import { DOMAIN_PRIORITIES } from '../../core/types'
import {
  verifyAnswer,
  isVerificationRequest,
  hasQuestionToVerify,
  hasCorrectAnswer,
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

    // Si el contexto es psicotécnico y NO es una petición explícita de verificación,
    // ceder al PsychometricDomain que maneja follow-ups de psicotécnicos mejor
    const isPsico = qc?.isPsicotecnico || qc?.questionSubtype || qc?.contentData
    if (isPsico && !isVerification && !asksAboutAnswer) {
      logger.info('VerificationDomain: Psychometric context, deferring to PsychometricDomain', { domain: 'verification' })
      return false
    }

    // INTELIGENTE: Si hay contexto de pregunta con respuesta correcta,
    // y el mensaje es corto/genérico (no menciona otra ley o tema),
    // probablemente quiere saber sobre la respuesta actual
    const hasAnswerContext = hasCorrectAnswer(context)
    const isShortGenericMessage = this.isShortGenericMessage(context.currentMessage)
    const contextualFollowUp = hasAnswerContext && isShortGenericMessage

    logger.info('VerificationDomain pattern check', {
      domain: 'verification',
      isVerification,
      asksAboutAnswer,
      hasAnswerContext,
      isShortGenericMessage,
      contextualFollowUp,
    })

    // Solo capturar si hay correctAnswer disponible (usuario ya respondió).
    // Si no hay correctAnswer, dejar pasar al fallback con RAG que puede
    // buscar el artículo o dar contexto sin necesidad de la respuesta.
    if ((isVerification || asksAboutAnswer || contextualFollowUp) && hasAnswerContext) {
      logger.debug('VerificationDomain will handle request', {
        domain: 'verification',
        isVerification,
        asksAboutAnswer,
        contextualFollowUp,
      })
      return true
    }

    return false
  }

  /**
   * Procesa el contexto y genera una respuesta
   */
  async handle(context: ChatContext, tracer?: AITracerInterface): Promise<ChatResponse> {
    const startTime = Date.now()

    logger.info('VerificationDomain handling request', {
      domain: 'verification',
      userId: context.userId,
      questionId: context.questionContext?.questionId ?? undefined,
    })

    // Verificar si tenemos la respuesta correcta disponible
    // (solo está disponible después de que el usuario responde)
    if (!hasCorrectAnswer(context)) {
      logger.info('VerificationDomain: No correctAnswer available, checking if message is a knowledge question', {
        domain: 'verification',
        message: context.currentMessage?.substring(0, 80),
      })

      // Si el usuario pregunta "qué artículo es/regula/dice" o similar sin haber respondido,
      // es una pregunta de conocimiento, no de verificación. Delegar a SearchDomain.
      // Excluir preguntas de búsqueda de exámenes (ej: "qué artículos caen en exámenes")
      const msg = context.currentMessage
      const isSearchQuery = /ca[ií]do.*ex[aá]men|m[aá]s\s+importantes?|suelen\s+caer|tipos?\s+de\s+preguntas/i.test(msg)
      const isKnowledgeQuestion = !isSearchQuery && (
        this.asksAboutAnswer(msg) || /art[ií]culo|ley|regula|norma/i.test(msg)
      )

      if (isKnowledgeQuestion) {
        logger.info('VerificationDomain: Knowledge question without answer → returning null to let other domains handle', {
          domain: 'verification',
        })
        // Devolver null para que el Orchestrator continúe con routing normal
        // (SearchDomain buscará el artículo en la BD)
        return null!
      }

      return new ChatResponseBuilder()
        .domain('verification')
        .text('🤔 **Primero responde la pregunta** para que pueda explicarte por qué es correcta o incorrecta.\n\nAsí evitamos hacer spoiler de la respuesta. ¡Inténtalo y luego hablamos!')
        .processingTime(Date.now() - startTime)
        .build()
    }

    // Extraer datos de verificación
    const input = extractVerificationInput(context)

    if (!input) {
      return new ChatResponseBuilder()
        .domain('verification')
        .text('No tengo suficiente información sobre la pregunta para verificarla.')
        .processingTime(Date.now() - startTime)
        .build()
    }

    // Span de verificación - COMPLETO
    const verifySpan = tracer?.spanDB('verifyAnswer', {
      // Contexto de usuario
      userId: context.userId,
      isPremium: context.isPremium,
      userMessage: context.currentMessage,
      // Datos de la pregunta
      questionId: context.questionContext?.questionId,
      questionText: context.questionContext?.questionText,
      // Datos de verificación
      markedCorrect: input.markedCorrect,
      questionOptions: input.options,
      lawName: input.lawName,
      articleNumber: input.articleNumber,
    })

    // Realizar verificación
    const result = await verifyAnswer(input, context)

    verifySpan?.setOutput({
      // Resultado de verificación
      errorDetected: result.errorDetected,
      errorDetails: result.errorDetails,
      // Respuesta generada
      response: result.response,
      responseLength: result.response.length,
      // Fuentes usadas
      sourcesCount: result.sources.length,
      sources: result.sources,
    })
    verifySpan?.end()

    // Construir respuesta
    const builder = new ChatResponseBuilder()
      .domain('verification')
      .text(result.response)
      .processingTime(Date.now() - startTime)

    if (result.tokensUsed) {
      builder.tokensUsed(result.tokensUsed)
    }

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
   * Detecta si el usuario pregunta sobre la respuesta de la pregunta actual
   * IMPORTANTE: Estos patrones deben ser específicos para preguntas sobre la respuesta,
   * NO para preguntas generales de búsqueda como "¿Qué artículos han caído en exámenes?"
   */
  private asksAboutAnswer(message: string): boolean {
    // Excluir preguntas que claramente son de búsqueda, no sobre la respuesta
    const searchPatterns = [
      /ca[ií]do.*ex[aá]men/i,     // "han caído en exámenes"
      /m[aá]s\s+importantes?/i,   // "más importantes"
      /suelen\s+caer/i,          // "suelen caer"
      /tipos?\s+de\s+preguntas/i, // "tipo de preguntas"
    ]
    if (searchPatterns.some(p => p.test(message))) {
      return false
    }

    const patterns = [
      /por\s*qu[eé]\s+(es|la|esta)/i,  // "por qué es...", "por qué la respuesta..."
      /c[oó]mo\s+se\s+llega/i,
      /expl[ií]ca(me)?\s+(la|esta|por)/i,  // "explícame la respuesta", no "explica qué es..."
      /no\s+entiendo\s+(la|esta|por)/i,    // "no entiendo la respuesta"
      /cu[aá]l\s+es\s+la\s+(correcta|respuesta)/i,
      /d[oó]nde\s+viene\s+(esto|la|esta)/i,  // "dónde viene esto"
      /qu[eé]\s+art[ií]culo\s+(es|regula|dice)/i,  // "qué artículo es", "qué artículo regula esto"
      /en\s+qu[eé]\s+(ley|art[ií]culo)\s+(est[aá]|viene|se)/i,  // "en qué artículo está"
    ]

    return patterns.some(p => p.test(message))
  }

  /**
   * Detecta si el mensaje es corto y genérico (no menciona otro tema)
   * Usado para detectar mensajes de seguimiento como "ok", "vale", "ya respondí", etc.
   */
  private isShortGenericMessage(message: string): boolean {
    // Si es muy largo, probablemente es una pregunta específica sobre otro tema
    if (message.length > 100) return false

    // Si parece un follow-up de búsqueda (ej: "y del tribunal constitucional"),
    // NO es un seguimiento de verificación - déjalo para SearchDomain
    const isSearchFollowUp = /^y\s+(del?|de la|sobre|en)\s+/i.test(message) ||
                             /^(qué|que)\s+hay\s+(del?|de la|sobre)/i.test(message)
    if (isSearchFollowUp) {
      logger.info('VerificationDomain: Rejecting search follow-up pattern, deferring to SearchDomain', {
        domain: 'verification',
        message: message.substring(0, 50),
      })
      return false
    }

    // Si menciona una ley específica diferente, probablemente es otra consulta
    const mentionsSpecificLaw = /\b(ley\s+\d+|art[ií]culo\s+\d+|CE\b|LOPJ\b|LOTC\b|LEC\b)/i.test(message)
    if (mentionsSpecificLaw) return false

    // Si menciona palabras clave de otro tema, no es seguimiento
    const otherTopicKeywords = /\b(plazos?|recurso|procedimiento|competencia|jurisdicci[oó]n|notificaci[oó]n)\b/i
    if (otherTopicKeywords.test(message)) return false

    // Mensaje corto sin temas específicos = probablemente seguimiento
    return true
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
