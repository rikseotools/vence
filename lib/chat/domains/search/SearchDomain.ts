// lib/chat/domains/search/SearchDomain.ts
// Dominio de búsqueda de artículos para el chat

import type { ChatDomain, ChatContext, ChatResponse, ArticleSource } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
import { logger } from '../../shared/logger'
import { DOMAIN_PRIORITIES } from '../../core/types'
import {
  searchArticles,
  formatArticlesForContext,
  generateSearchSuggestions,
  detectMentionedLaws,
  isGenericLawQuery,
} from './ArticleSearchService'
import { detectQueryPattern } from './PatternMatcher'

// ============================================
// DOMINIO DE BÚSQUEDA
// ============================================

export class SearchDomain implements ChatDomain {
  name = 'search'
  priority = DOMAIN_PRIORITIES.SEARCH

  /**
   * Determina si este dominio puede manejar el contexto
   */
  async canHandle(context: ChatContext): Promise<boolean> {
    const msg = context.currentMessage.toLowerCase()

    // Patrones que indican búsqueda de información legal
    const searchIndicators = [
      // Preguntas sobre leyes
      /qu[eé]\s+(dice|establece|regula)/i,
      /seg[uú]n\s+(la\s+)?ley/i,
      /art[ií]culo\s+\d+/i,
      /\bley\s+\d+/i,
      /\bla\s+\d+\/\d+/i,

      // Patrones legales
      /plazo|plazos/i,
      /recurso|recursos/i,
      /silencio\s+administrativo/i,
      /notificaci[oó]n/i,
      /procedimiento/i,
      /competencia/i,
      /delegaci[oó]n/i,
      /nulidad|anulabilidad/i,
      /sanci[oó]n|sancionador/i,

      // Preguntas de concepto (con soporte de tildes)
      /qu[eé]\s+es\s+(el|la|un|una)/i,
      /expl[ií]ca(me|r)?/i,  // explica, explícame, explicar, etc.
      /c[oó]mo\s+(funciona|se|es)/i,
      /por\s*qu[eé]/i,  // por qué, porque
      /cu[aá]l\s+(es|son)/i,  // cuál es, cuáles son
      /d[oó]nde/i,  // dónde
      /respuesta\s+(correcta|incorrecta)/i,
    ]

    // Si hay contexto de pregunta con ley, activar búsqueda
    if (context.questionContext?.lawName) {
      logger.debug('SearchDomain: questionContext has lawName, will handle', {
        domain: 'search',
        lawName: context.questionContext.lawName,
      })
      return true
    }

    // Detectar si hay leyes mencionadas en el mensaje
    const mentionedLaws = detectMentionedLaws(msg)
    if (mentionedLaws.length > 0) return true

    // Detectar si hay patrón legal
    const pattern = detectQueryPattern(msg)
    if (pattern) return true

    // Verificar indicadores de búsqueda
    return searchIndicators.some(regex => regex.test(msg))
  }

  /**
   * Procesa el contexto y genera una respuesta
   */
  async handle(context: ChatContext): Promise<ChatResponse> {
    const startTime = Date.now()

    logger.info('SearchDomain handling request', {
      domain: 'search',
      userId: context.userId,
      hasQuestionContext: !!context.questionContext,
    })

    // 1. Buscar artículos relevantes
    const searchResult = await searchArticles(context, {
      userOposicion: context.userDomain,
      contextLawName: context.questionContext?.lawName,
      limit: 10,
    })

    logger.info(`Search completed: ${searchResult.articles.length} articles found via ${searchResult.searchMethod}`, {
      domain: 'search',
    })

    // 2. Verificar si es consulta genérica sobre una ley
    if (isGenericLawQuery(context.currentMessage, searchResult.mentionedLaws)) {
      return this.handleGenericLawQuery(context, searchResult.mentionedLaws[0])
    }

    // 3. Generar respuesta con OpenAI
    const response = await this.generateResponse(context, searchResult)

    // 4. Construir respuesta final
    const builder = new ChatResponseBuilder()
      .domain('search')
      .text(response)
      .processingTime(Date.now() - startTime)

    // Añadir fuentes
    if (searchResult.articles.length > 0) {
      const sources: ArticleSource[] = searchResult.articles.slice(0, 5).map(a => ({
        lawName: a.lawShortName,
        articleNumber: a.articleNumber,
        title: a.title || undefined,
        relevance: a.similarity,
      }))
      builder.addSources(sources).withSourcesBlock()
    }

    return builder.build()
  }

  /**
   * Maneja consultas genéricas sobre una ley
   */
  private handleGenericLawQuery(context: ChatContext, lawName: string): ChatResponse {
    const response = `Has mencionado la **${lawName}**. ¿Qué aspecto específico te gustaría conocer?

Puedo ayudarte con:
• **Plazos** - Términos y plazos establecidos
• **Procedimientos** - Fases y trámites
• **Recursos** - Impugnaciones y revisiones
• **Órganos** - Competencias y composición
• **Definiciones** - Conceptos clave

💡 *Tip: Cuanto más específica sea tu pregunta, mejor podré ayudarte.*`

    return new ChatResponseBuilder()
      .domain('search')
      .text(response)
      .build()
  }

  /**
   * Genera respuesta usando OpenAI con contexto de artículos
   */
  private async generateResponse(
    context: ChatContext,
    searchResult: Awaited<ReturnType<typeof searchArticles>>
  ): Promise<string> {
    const openai = await getOpenAI()
    const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

    // Construir contexto de artículos
    const articlesContext = formatArticlesForContext(searchResult.articles)

    // System prompt específico para búsqueda
    const systemPrompt = this.buildSystemPrompt(context, searchResult)

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // Añadir historial de conversación (últimos mensajes)
    const recentHistory = context.messages.slice(-6)
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    // Añadir contexto de artículos al mensaje actual
    const userMessageWithContext = `${context.currentMessage}

---
ARTÍCULOS RELEVANTES:
${articlesContext}`

    messages.push({ role: 'user', content: userMessageWithContext })

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      })

      return completion.choices[0]?.message?.content || 'No pude generar una respuesta.'
    } catch (error) {
      logger.error('Error generating response with OpenAI', error, { domain: 'search' })
      return 'Hubo un error al procesar tu consulta. Por favor, intenta de nuevo.'
    }
  }

  /**
   * Construye el system prompt para búsqueda
   */
  private buildSystemPrompt(
    context: ChatContext,
    searchResult: Awaited<ReturnType<typeof searchArticles>>
  ): string {
    let prompt = `Eres un asistente experto en derecho administrativo español, especializado en oposiciones.

Tu objetivo es responder preguntas sobre legislación de forma precisa y clara, SIEMPRE basándote en los artículos proporcionados.

## Directrices:
1. **Cita siempre la fuente**: Menciona la ley y artículo específico (ej: "Según el Art. 21 de la Ley 39/2015...")
2. **Sé preciso**: Usa el contenido exacto de los artículos proporcionados
3. **Sé conciso**: Responde de forma directa sin rodeos
4. **Si no hay artículos relevantes**: Indica que no encontraste información específica
5. **Formato**: Usa markdown para estructurar la respuesta (negritas, listas, etc.)

## Información de búsqueda:
- Método de búsqueda: ${searchResult.searchMethod}
- Artículos encontrados: ${searchResult.articles.length}
- Leyes mencionadas: ${searchResult.mentionedLaws.join(', ') || 'ninguna específica'}`

    // Añadir contexto de pregunta si existe
    if (context.questionContext) {
      const qc = context.questionContext
      prompt += `

## Contexto de pregunta de test:
- Ley: ${qc.lawName || 'No especificada'}
- Artículo: ${qc.articleNumber || 'No especificado'}`

      if (qc.questionText) {
        prompt += `
- Pregunta: ${qc.questionText}`
      }
    }

    return prompt
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

let searchDomainInstance: SearchDomain | null = null

export function getSearchDomain(): SearchDomain {
  if (!searchDomainInstance) {
    searchDomainInstance = new SearchDomain()
  }
  return searchDomainInstance
}
