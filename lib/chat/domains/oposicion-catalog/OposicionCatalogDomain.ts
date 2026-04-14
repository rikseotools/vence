// lib/chat/domains/oposicion-catalog/OposicionCatalogDomain.ts
// Dominio: detectar preguntas sobre oposiciones, matchear contra catálogo y
// registrar solicitudes para las que no tenemos preparadas.

import type { ChatDomain, ChatContext, ChatResponse, AITracerInterface } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { logger } from '../../shared/logger'
import { DOMAIN_PRIORITIES } from '../../core/types'
import {
  detectOposicionIntent,
  isCatalogFollowUp,
  processOposicionCatalog,
} from './OposicionCatalogService'

export class OposicionCatalogDomain implements ChatDomain {
  name = 'oposicion-catalog'
  priority = DOMAIN_PRIORITIES.OPOSICION_CATALOG

  private _isFollowUp = false

  async canHandle(context: ChatContext): Promise<boolean> {
    // No interferir con preguntas que tienen contexto de pregunta de test
    if (context.questionContext?.questionId) return false

    // Intent directo (usuario menciona "oposición de X", "preparáis X", etc.)
    if (detectOposicionIntent(context.currentMessage)) {
      this._isFollowUp = false
      return true
    }

    // Follow-up de una respuesta previa de este dominio
    if (isCatalogFollowUp(context.messages, context.currentMessage)) {
      this._isFollowUp = true
      return true
    }

    return false
  }

  async handle(context: ChatContext, tracer?: AITracerInterface): Promise<ChatResponse> {
    const startTime = Date.now()
    const isFollowUp = this._isFollowUp
    this._isFollowUp = false

    logger.info('OposicionCatalogDomain handling request', {
      domain: 'oposicion-catalog',
      userId: context.userId,
      isFollowUp,
    })

    const dbSpan = tracer?.spanDB('oposicionCatalogLookup', {
      userId: context.userId,
      userOposicion: context.userDomain,
      message: context.currentMessage,
      isFollowUp,
    })

    try {
      const result = await processOposicionCatalog({
        message: context.currentMessage,
        userId: context.userId !== 'anonymous' ? context.userId : null,
        userOposicion: context.userDomain ?? null,
        logId: context.logId ?? null,
        isFollowUp,
      })

      dbSpan?.setOutput({
        matched: result.matched,
        matchedSlug: result.matchedSlug,
        feedbackId: result.feedbackId,
        detectedName: result.detectedName,
        responseLength: result.responseText.length,
      })
      dbSpan?.end()

      return new ChatResponseBuilder()
        .domain('oposicion-catalog')
        .text(result.responseText)
        .processingTime(Date.now() - startTime)
        .build()
    } catch (error) {
      logger.error('Error in OposicionCatalogDomain', error, { domain: 'oposicion-catalog' })
      dbSpan?.setOutput({ error: (error as Error).message })
      dbSpan?.end()
      return new ChatResponseBuilder()
        .domain('oposicion-catalog')
        .text('Hubo un problema comprobando el catálogo de oposiciones. Por favor, inténtalo de nuevo.')
        .processingTime(Date.now() - startTime)
        .build()
    }
  }
}

let instance: OposicionCatalogDomain | null = null

export function getOposicionCatalogDomain(): OposicionCatalogDomain {
  if (!instance) instance = new OposicionCatalogDomain()
  return instance
}
