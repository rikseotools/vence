// lib/chat/domains/stats/StatsDomain.ts
// Dominio de estadísticas para el chat

import type { ChatDomain, ChatContext, ChatResponse } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
import { logger } from '../../shared/logger'
import { DOMAIN_PRIORITIES } from '../../core/types'
import {
  searchStats,
  detectStatsQueryType,
  formatExamStatsResponse,
  formatUserStatsResponse,
} from './StatsService'

// ============================================
// DOMINIO DE ESTADÍSTICAS
// ============================================

export class StatsDomain implements ChatDomain {
  name = 'stats'
  priority = DOMAIN_PRIORITIES.STATS // Prioridad 4

  /**
   * Determina si este dominio puede manejar el contexto
   */
  async canHandle(context: ChatContext): Promise<boolean> {
    // No manejar si es una pregunta de psicotécnicos
    const isPsicotecnico = /psicot[eé]c?n?i?c?o?s?|series\s+num[eé]ricas/i.test(
      context.currentMessage
    )
    if (isPsicotecnico) {
      return false
    }

    const queryType = detectStatsQueryType(context.currentMessage)
    const canHandle = queryType !== 'none'

    if (canHandle) {
      // Para estadísticas de usuario, necesitamos userId
      if (queryType === 'user' && !context.userId) {
        logger.debug('User stats query but no userId, skipping', { domain: 'stats' })
        return false
      }

      logger.debug(`StatsDomain will handle request: ${queryType}`, { domain: 'stats' })
    }

    return canHandle
  }

  /**
   * Procesa el contexto y genera una respuesta
   */
  async handle(context: ChatContext): Promise<ChatResponse> {
    const startTime = Date.now()

    logger.info('StatsDomain handling request', {
      domain: 'stats',
      userId: context.userId,
    })

    try {
      // Obtener estadísticas
      const statsResult = await searchStats(context)

      // Si no se encontraron estadísticas
      if (statsResult.type === 'none') {
        return this.handleNoStats(context, startTime)
      }

      // Formatear respuesta según el tipo
      let responseText: string

      if (statsResult.type === 'exam' && statsResult.examStats) {
        responseText = formatExamStatsResponse(statsResult.examStats)
      } else if (statsResult.type === 'user' && statsResult.userStats) {
        responseText = formatUserStatsResponse(
          statsResult.userStats,
          statsResult.temporalFilter.label
        )
      } else {
        // Si pidió stats pero no hay datos
        return this.handleNoData(context, statsResult.type, startTime)
      }

      return new ChatResponseBuilder()
        .domain('stats')
        .text(responseText)
        .processingTime(Date.now() - startTime)
        .build()
    } catch (error) {
      logger.error('Error in StatsDomain', error, { domain: 'stats' })
      return this.handleError(startTime)
    }
  }

  /**
   * Maneja cuando no se detectó tipo de estadísticas
   */
  private handleNoStats(context: ChatContext, startTime: number): ChatResponse {
    const response = `No entendí qué estadísticas necesitas. Puedo ayudarte con:

📊 **Estadísticas de Exámenes Oficiales:**
- "¿Qué artículos caen más en el examen?"
- "¿Qué preguntas suelen caer de la Ley 39/2015?"
- "¿Qué es lo más preguntado?"

📈 **Tu Progreso Personal:**
- "¿Dónde fallo más?"
- "¿Cómo voy esta semana?"
- "¿Qué artículos debería repasar?"

¿Qué te gustaría saber?`

    return new ChatResponseBuilder()
      .domain('stats')
      .text(response)
      .processingTime(Date.now() - startTime)
      .build()
  }

  /**
   * Maneja cuando no hay datos para mostrar
   */
  private handleNoData(
    context: ChatContext,
    type: string,
    startTime: number
  ): ChatResponse {
    let response: string

    if (type === 'exam') {
      response = `📊 No encontré estadísticas de exámenes oficiales${context.currentMessage.includes('39/2015') ? ' para la Ley 39/2015' : ''}.

Esto puede deberse a que:
- No hay preguntas de exámenes oficiales con ese filtro
- La ley mencionada no tiene preguntas oficiales registradas

¿Te gustaría ver las estadísticas generales de todos los exámenes?`
    } else {
      response = `📈 No tienes estadísticas de estudio todavía.

Esto puede deberse a que:
- Aún no has completado tests con preguntas de leyes
- No tienes respuestas en el período seleccionado

💡 **Tip:** Completa algunos tests para empezar a ver tu progreso y áreas de mejora.

¿Te gustaría empezar un test ahora?`
    }

    return new ChatResponseBuilder()
      .domain('stats')
      .text(response)
      .processingTime(Date.now() - startTime)
      .build()
  }

  /**
   * Maneja errores
   */
  private handleError(startTime: number): ChatResponse {
    return new ChatResponseBuilder()
      .domain('stats')
      .text('Hubo un error al obtener las estadísticas. Por favor, intenta de nuevo.')
      .processingTime(Date.now() - startTime)
      .build()
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

let statsDomainInstance: StatsDomain | null = null

export function getStatsDomain(): StatsDomain {
  if (!statsDomainInstance) {
    statsDomainInstance = new StatsDomain()
  }
  return statsDomainInstance
}
