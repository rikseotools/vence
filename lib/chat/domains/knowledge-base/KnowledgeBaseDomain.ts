// lib/chat/domains/knowledge-base/KnowledgeBaseDomain.ts
// Dominio de base de conocimiento para el chat

import type { ChatDomain, ChatContext, ChatResponse } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
import { logger } from '../../shared/logger'
import { DOMAIN_PRIORITIES } from '../../core/types'
import {
  searchKB,
  formatKBContext,
  getShortAnswer,
  generateKBSuggestions,
  getPredefinedResponse,
  isPlatformQuery,
} from './KnowledgeBaseService'

// ============================================
// DOMINIO DE KNOWLEDGE BASE
// ============================================

export class KnowledgeBaseDomain implements ChatDomain {
  name = 'knowledge-base'
  priority = DOMAIN_PRIORITIES.KNOWLEDGE_BASE // Prioridad 2

  /**
   * Determina si este dominio puede manejar el contexto
   */
  async canHandle(context: ChatContext): Promise<boolean> {
    // Verificar si es una consulta sobre la plataforma
    const isKBQuery = isPlatformQuery(context.currentMessage)

    if (isKBQuery) {
      logger.debug('KnowledgeBaseDomain will handle request', {
        domain: 'knowledge-base',
      })
    }

    return isKBQuery
  }

  /**
   * Procesa el contexto y genera una respuesta
   */
  async handle(context: ChatContext): Promise<ChatResponse> {
    const startTime = Date.now()

    logger.info('KnowledgeBaseDomain handling request', {
      domain: 'knowledge-base',
      userId: context.userId,
    })

    // 1. Verificar si hay respuesta predefinida
    const predefinedResponse = getPredefinedResponse(context.currentMessage)
    if (predefinedResponse) {
      logger.debug('Using predefined response', { domain: 'knowledge-base' })

      return new ChatResponseBuilder()
        .domain('knowledge-base')
        .text(predefinedResponse)
        .processingTime(Date.now() - startTime)
        .build()
    }

    // 2. Buscar en la knowledge base
    const searchResult = await searchKB(context)

    // 3. Si no hay resultados, devolver respuesta genérica
    if (searchResult.entries.length === 0) {
      return this.handleNoResults(context, startTime)
    }

    // 4. Si hay respuesta corta y la pregunta es simple, usarla
    const shortAnswer = getShortAnswer(searchResult.entries)
    if (shortAnswer && this.isSimpleQuestion(context.currentMessage)) {
      logger.debug('Using short answer', { domain: 'knowledge-base' })

      return new ChatResponseBuilder()
        .domain('knowledge-base')
        .text(shortAnswer)
        .processingTime(Date.now() - startTime)
        .build()
    }

    // 5. Generar respuesta con OpenAI usando el contexto de KB
    const response = await this.generateResponse(context, searchResult)

    return new ChatResponseBuilder()
      .domain('knowledge-base')
      .text(response)
      .processingTime(Date.now() - startTime)
      .build()
  }

  /**
   * Maneja cuando no hay resultados en la KB
   */
  private handleNoResults(context: ChatContext, startTime: number): ChatResponse {
    const suggestions = generateKBSuggestions(null)

    const response = `No tengo información específica sobre eso, pero puedo ayudarte con otras cosas sobre la plataforma.

**Algunas preguntas frecuentes:**
${suggestions.map(s => `• ${s}`).join('\n')}

¿Hay algo más en lo que pueda ayudarte?`

    return new ChatResponseBuilder()
      .domain('knowledge-base')
      .text(response)
      .processingTime(Date.now() - startTime)
      .build()
  }

  /**
   * Genera respuesta usando OpenAI con contexto de KB
   */
  private async generateResponse(
    context: ChatContext,
    searchResult: Awaited<ReturnType<typeof searchKB>>
  ): Promise<string> {
    const openai = await getOpenAI()
    const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

    // Construir el contexto de KB
    const kbContext = formatKBContext(searchResult.entries)

    // System prompt específico para KB
    const systemPrompt = this.buildSystemPrompt()

    // Construir mensaje del usuario con contexto
    const userMessage = `${context.currentMessage}

${kbContext}`

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      })

      return completion.choices[0]?.message?.content || 'No pude generar una respuesta.'
    } catch (error) {
      logger.error('Error generating KB response', error, { domain: 'knowledge-base' })
      return 'Hubo un error al procesar tu consulta. Por favor, intenta de nuevo.'
    }
  }

  /**
   * Construye el system prompt para KB
   */
  private buildSystemPrompt(): string {
    return `Eres el asistente de Vence, una plataforma de preparación para oposiciones.

Tu rol es ayudar a los usuarios con preguntas sobre la plataforma, planes, funcionalidades, etc.

## Directrices:
1. **Sé amigable y cercano** - Usa un tono conversacional
2. **Sé conciso** - Responde de forma directa sin rodeos
3. **Usa la información proporcionada** - Basa tus respuestas en el contexto de KB
4. **No inventes** - Si no tienes la información, indica que el usuario contacte soporte
5. **Usa markdown** - Formatea las respuestas para mejor lectura

## Sobre Vence:
- Plataforma de preparación para oposiciones
- Tests con preguntas de exámenes oficiales y generadas por IA
- Asistente de chat con IA para resolver dudas
- Estadísticas y seguimiento del progreso
- Diferentes planes: Free y Premium

## Temas que manejas:
- Planes y precios
- Funcionalidades de la plataforma
- Cómo usar los diferentes tipos de test
- Estadísticas y progreso
- Preguntas frecuentes
- Soporte y contacto`
  }

  /**
   * Determina si es una pregunta simple que puede responderse con shortAnswer
   */
  private isSimpleQuestion(message: string): boolean {
    const simplePatterns = [
      /^(qué|que|cuál|cual)\s+(es|son)\s/i,
      /^cu[aá]nto\s+cuesta/i,
      /^(hay|tiene|tenéis)/i,
      /^precio/i,
    ]

    return simplePatterns.some(p => p.test(message.trim()))
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

let knowledgeBaseDomainInstance: KnowledgeBaseDomain | null = null

export function getKnowledgeBaseDomain(): KnowledgeBaseDomain {
  if (!knowledgeBaseDomainInstance) {
    knowledgeBaseDomainInstance = new KnowledgeBaseDomain()
  }
  return knowledgeBaseDomainInstance
}
