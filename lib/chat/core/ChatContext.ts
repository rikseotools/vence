// lib/chat/core/ChatContext.ts
// Builder de contexto de chat

import { chatRequestSchema, type ChatContext, type ChatRequest, MAX_CONTEXT_MESSAGES } from './types'
import { ValidationError } from '../shared/errors'
import { logger } from '../shared/logger'

interface BuildContextOptions {
  userId: string
  userName?: string
  userDomain: string
  isPremium?: boolean
}

/**
 * Construye el contexto de chat a partir del request
 */
export function buildChatContext(
  rawRequest: unknown,
  options: BuildContextOptions
): ChatContext {
  // Validar request con Zod
  const parseResult = chatRequestSchema.safeParse(rawRequest)

  if (!parseResult.success) {
    logger.warn('Invalid chat request', {
      domain: 'context',
      errors: parseResult.error.flatten(),
    })
    throw new ValidationError('Request inválido', {
      errors: parseResult.error.flatten().fieldErrors,
    })
  }

  const request = parseResult.data

  // Obtener mensaje actual (último del usuario)
  const userMessages = request.messages.filter(m => m.role === 'user')
  const currentMessage = userMessages[userMessages.length - 1]?.content || ''

  if (!currentMessage.trim()) {
    throw new ValidationError('Mensaje vacío')
  }

  // Limitar historial de mensajes
  const limitedMessages = request.messages.slice(-MAX_CONTEXT_MESSAGES)

  const context: ChatContext = {
    request,
    userId: options.userId,
    userName: options.userName,
    userDomain: options.userDomain,
    isPremium: options.isPremium ?? request.isPremium ?? false,
    questionContext: request.questionContext,
    messages: limitedMessages,
    currentMessage,
    conversationId: request.conversationId,
    startTime: Date.now(),
  }

  logger.debug('Chat context built', {
    domain: 'context',
    userId: options.userId,
    hasQuestionContext: !!request.questionContext,
    messageCount: limitedMessages.length,
    isPremium: context.isPremium,
  })

  return context
}

/**
 * Extrae información útil del contexto de pregunta
 */
export function getQuestionInfo(context: ChatContext): {
  hasQuestion: boolean
  lawName?: string
  articleNumber?: string
  isAnswered: boolean
  wasCorrect?: boolean
} {
  const qc = context.questionContext

  if (!qc) {
    return { hasQuestion: false, isAnswered: false }
  }

  return {
    hasQuestion: true,
    lawName: qc.lawName ?? undefined,
    articleNumber: qc.articleNumber ?? undefined,
    isAnswered: qc.selectedAnswer !== undefined,
    wasCorrect: qc.correctAnswer !== undefined && qc.selectedAnswer !== undefined
      ? qc.selectedAnswer === qc.correctAnswer
      : undefined,
  }
}

/**
 * Detecta la intención del mensaje actual
 */
export function detectMessageIntent(context: ChatContext): {
  isVerificationRequest: boolean
  isExplanationRequest: boolean
  isSearchRequest: boolean
  isStatsRequest: boolean
  isGreeting: boolean
} {
  const msg = context.currentMessage.toLowerCase()

  // Patrones de verificación
  const verificationPatterns = [
    /está.*(bien|mal|correcto|incorrecto)/i,
    /es.*(correcta?|incorrecta?)/i,
    /verifica/i,
    /comprueba/i,
    /seguro que/i,
    /error en la (pregunta|respuesta)/i,
  ]

  // Patrones de explicación
  const explanationPatterns = [
    /explica/i,
    /por qué/i,
    /cuál es la razón/i,
    /no entiendo/i,
    /qué significa/i,
  ]

  // Patrones de búsqueda
  const searchPatterns = [
    /qué dice/i,
    /artículo \d+/i,
    /según la ley/i,
    /plazo para/i,
    /cuánto tiempo/i,
    /quién puede/i,
    /requisitos para/i,
  ]

  // Patrones de estadísticas
  const statsPatterns = [
    /mi(s)? (estadística|resultado|progreso)/i,
    /cómo (voy|llevo)/i,
    /porcentaje de acierto/i,
    /áreas? (débil|fuerte)/i,
  ]

  // Saludos
  const greetingPatterns = [
    /^(hola|buenos días|buenas tardes|buenas noches|hey|saludos)/i,
  ]

  return {
    isVerificationRequest: verificationPatterns.some(p => p.test(msg)),
    isExplanationRequest: explanationPatterns.some(p => p.test(msg)),
    isSearchRequest: searchPatterns.some(p => p.test(msg)),
    isStatsRequest: statsPatterns.some(p => p.test(msg)),
    isGreeting: greetingPatterns.some(p => p.test(msg)),
  }
}

/**
 * Formatea el historial de mensajes para OpenAI
 */
export function formatMessagesForOpenAI(
  context: ChatContext,
  systemPrompt: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const formatted: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  for (const msg of context.messages) {
    formatted.push({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })
  }

  return formatted
}
