// lib/chat/domains/stats/StatsDomain.ts
// Dominio de estadísticas para el chat

import type { ChatDomain, ChatContext, ChatResponse, AITracerInterface } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
import { logger } from '../../shared/logger'
import { DOMAIN_PRIORITIES } from '../../core/types'
import {
  searchStats,
  detectStatsQueryType,
  extractLawFromMessage,
  loadLawsCache,
  formatExamStatsResponse,
  formatUserStatsResponse,
  formatWeakPointsTestResponse,
  formatWeeklyComparisonResponse,
} from './StatsService'
import { getWeeklyComparison } from './queries'

// Marcadores que indican que la respuesta anterior fue de stats
const STATS_RESPONSE_MARKERS = [
  'Estadísticas de Exámenes Oficiales',
  'Artículos más preguntados',
  'Tu Progreso de Estudio',
  'Tu Progreso: Esta Semana',
  'preguntas de exámenes oficiales',
]

/**
 * Detecta si el mensaje actual es un follow-up de una conversación de stats.
 * Ej: después de "¿Qué artículos de la LECrim son más preguntados?",
 * el usuario dice "Y de la LOPJ?" → debe tratarse como exam stats de LOPJ.
 */
export function isStatsFollowUp(messages: Array<{ role: string; content: string }>, currentMessage: string): boolean {
  // Buscar el último mensaje del assistant en el historial
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  if (!lastAssistant) return false

  // ¿El assistant respondió con stats?
  const wasStats = STATS_RESPONSE_MARKERS.some(marker =>
    lastAssistant.content.includes(marker)
  )
  if (!wasStats) return false

  // ¿El mensaje actual menciona una ley? (necesita cache cargada antes de llamar)
  const law = extractLawFromMessage(currentMessage)
  if (!law) return false

  return true
}

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

    if (queryType !== 'none') {
      // Para estadísticas de usuario, necesitamos userId
      if (queryType === 'user' && !context.userId) {
        logger.debug('User stats query but no userId, skipping', { domain: 'stats' })
        return false
      }

      logger.debug(`StatsDomain will handle request: ${queryType}`, { domain: 'stats' })
      return true
    }

    // queryType === 'none': comprobar si es un follow-up de stats
    // Ej: "Y de la LOPJ?" tras una respuesta de estadísticas de exámenes
    await loadLawsCache()
    if (isStatsFollowUp(context.messages, context.currentMessage)) {
      this._isFollowUp = true
      logger.debug('StatsDomain detected stats follow-up', { domain: 'stats' })
      return true
    }

    return false
  }

  /** Flag interno para indicar que el handle debe tratar como follow-up */
  private _isFollowUp = false

  /**
   * Procesa el contexto y genera una respuesta
   */
  async handle(context: ChatContext, tracer?: AITracerInterface): Promise<ChatResponse> {
    const startTime = Date.now()

    logger.info('StatsDomain handling request', {
      domain: 'stats',
      userId: context.userId,
    })

    try {
      // Span para búsqueda de estadísticas - COMPLETO
      const dbSpan = tracer?.spanDB('searchStats', {
        // Contexto de usuario
        userId: context.userId,
        isPremium: context.isPremium,
        userDomain: context.userDomain,
        // Mensaje completo
        message: context.currentMessage,
        // Contexto de pregunta si existe
        questionContext: context.questionContext ? {
          questionId: context.questionContext.questionId,
          lawName: context.questionContext.lawName,
        } : null,
      })

      // Obtener estadísticas (si es follow-up, forzar tipo 'exam')
      const statsResult = await searchStats(context, this._isFollowUp ? 'exam' : undefined)
      // Reset flag
      this._isFollowUp = false

      dbSpan?.setOutput({
        // Tipo de stats
        type: statsResult.type,
        // Resultados de exámenes
        hasExamStats: !!statsResult.examStats?.topArticles?.length,
        examStatsCount: statsResult.examStats?.topArticles?.length || 0,
        // Resultados de usuario
        hasUserStats: !!statsResult.userStats?.mostFailed?.length,
        userStatsMostFailedCount: statsResult.userStats?.mostFailed?.length || 0,
        // Filtro temporal
        temporalFilter: statsResult.temporalFilter,
        // Datos detallados (si existen)
        examTopArticles: statsResult.examStats?.topArticles?.slice(0, 10),
        userMostFailed: statsResult.userStats?.mostFailed?.slice(0, 10),
      })
      dbSpan?.end()

      // Si no se encontraron estadísticas
      if (statsResult.type === 'none') {
        return this.handleNoStats(context, startTime)
      }

      // Formatear respuesta según el tipo
      let responseText: string

      if (statsResult.type === 'weak_points_test') {
        // Usuario quiere empezar un test de puntos débiles
        responseText = formatWeakPointsTestResponse()
      } else if (statsResult.type === 'exam' && statsResult.examStats) {
        responseText = formatExamStatsResponse(statsResult.examStats)
      } else if (statsResult.type === 'user') {
        // Detectar si pregunta específicamente "cómo voy" para comparación semanal
        const isProgressQuery = /c[oó]mo\s*voy/i.test(context.currentMessage)

        if (isProgressQuery) {
          // Obtener comparación semanal
          const weeklyComparison = await getWeeklyComparison(context.userId)

          if (weeklyComparison) {
            responseText = formatWeeklyComparisonResponse(weeklyComparison)
          } else if (statsResult.userStats) {
            // Fallback a stats normales si no hay datos de comparación
            responseText = formatUserStatsResponse(
              statsResult.userStats,
              statsResult.temporalFilter.label
            )
          } else {
            return this.handleNoData(context, statsResult.type, startTime)
          }
        } else if (statsResult.userStats) {
          // Otras queries de usuario (áreas débiles, etc.)
          responseText = formatUserStatsResponse(
            statsResult.userStats,
            statsResult.temporalFilter.label
          )
        } else {
          return this.handleNoData(context, statsResult.type, startTime)
        }
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
