// lib/chat/domains/temario/TemarioDomain.ts
// Dominio para consultas sobre temarios, programas y epigrafes de oposiciones

import type { ChatDomain, ChatContext, ChatResponse, AITracerInterface } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
import { logger } from '../../shared/logger'
import { DOMAIN_PRIORITIES } from '../../core/types'
import { getTemarioSystemPrompt } from '../../shared/prompts'
import {
  getTopicsByPositionType,
  searchTopicsByContent,
  getOposicionInfo,
  getAllOposiciones,
  type TopicInfo,
  type OposicionInfo,
} from './queries'

// ============================================
// DETECCION DE QUERIES DE TEMARIO
// ============================================

/** Patrones que indican consulta sobre temario/programa/epigrafes */
const TEMARIO_PATTERNS = [
  // Preguntas directas sobre temario
  /\btemario\b/i,
  /\bep[ií]grafe/i,
  /\bprograma\s+(de\s+)?(la\s+)?oposici[oó]n/i,

  // "en que tema" / "que tema"
  /\b(en\s+)?qu[eé]\s+tema\b/i,
  /\bcu[aá]ntos\s+temas\b/i,

  // "donde se estudia X" / "donde entra X"
  /\bd[oó]nde\s+(se\s+)?(estudia|entra|ve|trata|aparece)/i,

  // "tema X" como consulta (ej: "tema los bienes", "tema 5")
  /^tema\s+/i,

  // "que temas hay" / "que temas tiene"
  /qu[eé]\s+temas\s+(hay|tiene|incluye|cubre)/i,

  // "que oposiciones" teneis/hay
  /qu[eé]\s+oposiciones\s+(ten[eé]is|hay|prepar[aá]is)/i,

  // "entra X en el temario" / "X esta en el temario"
  /entra.*\b(temario|programa)\b/i,
  /\b(temario|programa)\b.*entra/i,

  // "bloque I/II/1/2" - referencia a bloques del temario
  /\bbloque\s+(I{1,3}|IV|V|\d+)\b/i,
  // "temas del bloque" / "ver los temas"
  /\btemas\s+del\s+bloque/i,
  /\bver\s+(todos\s+)?(los\s+)?temas\b/i,
]

/** Patrones de temas conceptuales (el usuario pregunta por un concepto y quiere saber en que tema esta) */
const CONCEPT_TOPIC_PATTERNS = [
  // "tema los bienes de las administraciones publicas" - frase que empieza con "tema" + concepto
  /^tema\s+(de\s+)?(los?\s+|las?\s+|el\s+|la\s+)/i,
]

/** Consultas sobre temario que realmente son sobre la plataforma (precios, acceso) */
const TEMARIO_PLATFORM_EXCLUSIONS = [
  /temario(s)?\s+(gratis|gratuito|free|de\s+pago|premium)/i,
  /contenido\s+(gratis|gratuito)/i,
]

/**
 * Detecta si un mensaje es una consulta sobre temarios
 */
export function isTemarioQuery(message: string): boolean {
  // Excluir consultas que son sobre la plataforma (precios, acceso)
  if (TEMARIO_PLATFORM_EXCLUSIONS.some(p => p.test(message))) {
    return false
  }
  return TEMARIO_PATTERNS.some(p => p.test(message))
}

/**
 * Extrae terminos de busqueda del mensaje para buscar en topics
 */
export function extractTopicSearchTerms(message: string): string[] {
  let cleaned = message.toLowerCase()

  // Quitar frases de contexto comunes
  cleaned = cleaned
    .replace(/\b(en\s+)?qu[eé]\s+tema\s+(aparece|entra|est[aá]|se\s+ve|se\s+estudia|se\s+trata)\b/gi, '')
    .replace(/\bd[oó]nde\s+(se\s+)?(estudia|entra|ve|trata|aparece)\b/gi, '')
    .replace(/^tema\s+(de\s+)?/i, '')
    .replace(/\b(del?|las?|los?|el|en|un|una|por|con|que|qué|para|sobre|se)\b/gi, '')
    .replace(/[?¿!¡.,]/g, '')
    .trim()

  // Dividir en palabras significativas (>= 4 chars)
  const words = cleaned.split(/\s+/).filter(w => w.length >= 4)

  if (words.length === 0) return []

  // Devolver tanto la frase completa como palabras individuales
  const terms = [words.join(' ')]
  if (words.length > 1) {
    terms.push(...words)
  }

  return terms
}

// ============================================
// DOMINIO DE TEMARIO
// ============================================

export class TemarioDomain implements ChatDomain {
  name = 'temario'
  priority = DOMAIN_PRIORITIES.TEMARIO

  async canHandle(context: ChatContext): Promise<boolean> {
    const result = isTemarioQuery(context.currentMessage)

    if (result) {
      logger.debug('TemarioDomain will handle request', { domain: 'temario' })
    }

    return result
  }

  async handle(context: ChatContext, tracer?: AITracerInterface): Promise<ChatResponse> {
    const startTime = Date.now()
    const message = context.currentMessage

    logger.info('TemarioDomain handling request', {
      domain: 'temario',
      userId: context.userId,
      userDomain: context.userDomain,
    })

    // 1. Resolver la oposicion del usuario
    const { ID_TO_POSITION_TYPE } = await import('@/lib/config/oposiciones')
    const userPositionType = context.userDomain ? ID_TO_POSITION_TYPE[context.userDomain] : null

    // 2. Determinar que tipo de consulta es
    const queryType = this.classifyQuery(message)

    logger.info(`TemarioDomain query type: ${queryType}`, {
      domain: 'temario',
      userPositionType,
    })

    // Span DB
    const dbSpan = tracer?.spanDB('temarioQuery', {
      queryType,
      userDomain: context.userDomain,
      userPositionType,
      message,
    })

    let topics: TopicInfo[] = []
    let oposicionInfo: OposicionInfo | null = null
    let searchedAll = false

    switch (queryType) {
      case 'list_topics': {
        // "que temas hay", "temario", "cuantos temas"
        if (userPositionType) {
          topics = await getTopicsByPositionType(userPositionType)
          oposicionInfo = context.userDomain ? await getOposicionInfo(context.userDomain) : null
        } else {
          // Sin oposicion, mostrar las oposiciones disponibles
          const opos = await getAllOposiciones()
          return this.respondWithOposiciones(opos, startTime)
        }
        break
      }

      case 'search_concept': {
        // "tema los bienes", "donde se estudia X", "en que tema aparece X"
        const searchTerms = extractTopicSearchTerms(message)

        if (searchTerms.length > 0) {
          // Buscar primero en la oposicion del usuario
          if (userPositionType) {
            topics = await searchTopicsByContent(searchTerms, userPositionType)
            oposicionInfo = context.userDomain ? await getOposicionInfo(context.userDomain) : null
          }

          // Si no encontro, buscar en todas las oposiciones
          if (topics.length === 0) {
            topics = await searchTopicsByContent(searchTerms)
            searchedAll = true
          }
        }
        break
      }

      case 'list_oposiciones': {
        const opos = await getAllOposiciones()
        return this.respondWithOposiciones(opos, startTime)
      }

      case 'specific_topic': {
        // "tema 5", "tema 12" - buscar un tema especifico por numero
        const topicNumber = this.extractTopicNumber(message)
        if (topicNumber && userPositionType) {
          const allTopics = await getTopicsByPositionType(userPositionType)
          topics = allTopics.filter(t => t.topicNumber === topicNumber)
          oposicionInfo = context.userDomain ? await getOposicionInfo(context.userDomain) : null
        } else if (topicNumber) {
          // Sin oposicion, no sabemos que temario
          return new ChatResponseBuilder()
            .domain('temario')
            .text('Para mostrarte el contenido del tema, necesito saber tu oposicion. Puedes configurarla en tu perfil.')
            .processingTime(Date.now() - startTime)
            .build()
        }
        break
      }
    }

    dbSpan?.setOutput({
      topicsFound: topics.length,
      searchedAll,
      oposicion: oposicionInfo?.nombre,
    })
    dbSpan?.end()

    // 3. Generar respuesta con LLM usando los topics encontrados
    const { content, tokensUsed } = await this.generateResponse(
      context, topics, oposicionInfo, searchedAll, queryType, tracer
    )

    const builder = new ChatResponseBuilder()
      .domain('temario')
      .text(content)
      .processingTime(Date.now() - startTime)

    if (tokensUsed) {
      builder.tokensUsed(tokensUsed)
    }

    return builder.build()
  }

  /**
   * Clasifica el tipo de consulta sobre temario
   */
  private classifyQuery(message: string): 'list_topics' | 'search_concept' | 'list_oposiciones' | 'specific_topic' {
    const msg = message.toLowerCase()

    // "que oposiciones hay/teneis"
    if (/qu[eé]\s+oposiciones/i.test(msg)) {
      return 'list_oposiciones'
    }

    // "tema 5", "tema 12" - numero especifico
    if (/^tema\s+\d+/i.test(msg) || /\btema\s+(n[uú]mero\s+)?\d+/i.test(msg)) {
      return 'specific_topic'
    }

    // "que temas hay", "cuantos temas", "temario completo", "dame el temario", "bloque II"
    if (/qu[eé]\s+temas\s+(hay|tiene)/i.test(msg) ||
        /cu[aá]ntos\s+temas/i.test(msg) ||
        /temario\s+(completo|entero)/i.test(msg) ||
        /^temario$/i.test(msg.trim()) ||
        /dame.*temario/i.test(msg) ||
        /mu[eé]strame.*temario/i.test(msg) ||
        /\bbloque\s+(I{1,3}|IV|V|\d+)\b/i.test(msg) ||
        /\bver\s+(todos\s+)?(los\s+)?temas\b/i.test(msg)) {
      return 'list_topics'
    }

    // Todo lo demas es busqueda por concepto
    return 'search_concept'
  }

  /**
   * Extrae numero de tema del mensaje
   */
  private extractTopicNumber(message: string): number | null {
    const match = message.match(/\btema\s+(?:n[uú]mero\s+)?(\d+)/i)
    return match ? parseInt(match[1], 10) : null
  }

  /**
   * Respuesta cuando el usuario pregunta que oposiciones hay
   */
  private respondWithOposiciones(oposiciones: OposicionInfo[], startTime: number): ChatResponse {
    let text = '**Oposiciones disponibles en Vence:**\n\n'

    for (const o of oposiciones) {
      const temas = o.temasCount ? ` (${o.temasCount} temas)` : ''
      const grupo = o.grupo ? ` - ${o.grupo}` : ''
      text += `- **${o.nombre}**${grupo}${temas}\n`
    }

    text += '\nPuedes configurar tu oposicion en tu perfil para recibir contenido personalizado.'

    return new ChatResponseBuilder()
      .domain('temario')
      .text(text)
      .processingTime(Date.now() - startTime)
      .build()
  }

  /**
   * Genera respuesta con OpenAI usando el contexto de topics
   */
  private async generateResponse(
    context: ChatContext,
    topics: TopicInfo[],
    oposicionInfo: OposicionInfo | null,
    searchedAll: boolean,
    queryType: string,
    tracer?: AITracerInterface
  ): Promise<{ content: string; tokensUsed?: number }> {
    const openai = await getOpenAI()
    const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

    const systemPrompt = this.buildSystemPrompt(oposicionInfo)
    const topicsContext = this.formatTopicsContext(topics, oposicionInfo, searchedAll, queryType)

    const userMessage = `${context.currentMessage}

---
${topicsContext}`

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ]

    // Historial reciente
    const recentHistory = context.messages.slice(-4)
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content })
      }
    }

    messages.push({ role: 'user', content: userMessage })

    const llmSpan = tracer?.spanLLM({
      model,
      temperature: 0.5,
      maxTokens: 1200,
      systemPrompt,
      userPrompt: context.currentMessage,
      userPromptWithContext: userMessage,
      messagesArray: messages,
      topicsInContext: topics.length,
    })

    try {
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 1200,
      })

      const content = completion.choices[0]?.message?.content || 'No pude generar una respuesta.'
      const totalTokens = completion.usage?.total_tokens

      llmSpan?.setOutput({
        responseContent: content,
        finishReason: completion.choices[0]?.finish_reason,
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens,
      })
      llmSpan?.end()

      return { content, tokensUsed: totalTokens }
    } catch (error) {
      llmSpan?.setError(error instanceof Error ? error.message : 'Unknown error')
      llmSpan?.end()

      logger.error('Error generating temario response', error, { domain: 'temario' })
      return { content: 'Hubo un error al procesar tu consulta sobre el temario. Por favor, intenta de nuevo.' }
    }
  }

  private buildSystemPrompt(oposicionInfo: OposicionInfo | null): string {
    return getTemarioSystemPrompt(oposicionInfo?.nombre || 'su oposicion')
  }

  private formatTopicsContext(
    topics: TopicInfo[],
    oposicionInfo: OposicionInfo | null,
    searchedAll: boolean,
    queryType: string
  ): string {
    const opoName = oposicionInfo?.nombre || 'Desconocida'

    if (topics.length === 0) {
      return `DATOS DEL TEMARIO:
No se encontraron temas que coincidan con la busqueda.
Oposicion del usuario: ${opoName}
Tipo de consulta: ${queryType}
Se busco en todas las oposiciones: ${searchedAll ? 'Si' : 'No'}`
    }

    let context = `DATOS DEL TEMARIO (${opoName}):\n`
    context += `Temas encontrados: ${topics.length}\n`

    if (searchedAll) {
      context += `NOTA: No se encontro en el temario del usuario. Estos resultados son de otras oposiciones.\n`
    }

    context += `\n`

    // Agrupar por oposicion si searchedAll
    if (searchedAll) {
      const byType = new Map<string, TopicInfo[]>()
      for (const t of topics) {
        const existing = byType.get(t.positionType) || []
        existing.push(t)
        byType.set(t.positionType, existing)
      }

      byType.forEach((pts, pt) => {
        context += `--- Oposicion: ${pt} ---\n`
        for (const t of pts) {
          context += `Tema ${t.topicNumber}: ${t.title}\n`
          if (t.description) {
            context += `  Epigrafes: ${t.description}\n`
          }
        }
        context += `\n`
      })
    } else {
      for (const t of topics) {
        context += `Tema ${t.topicNumber}: ${t.title}\n`
        if (t.description) {
          context += `  Epigrafes: ${t.description}\n`
        }
      }
    }

    return context
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

let temarioDomainInstance: TemarioDomain | null = null

export function getTemarioDomain(): TemarioDomain {
  if (!temarioDomainInstance) {
    temarioDomainInstance = new TemarioDomain()
  }
  return temarioDomainInstance
}
