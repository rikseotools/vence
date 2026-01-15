// lib/chat/core/ChatOrchestrator.ts
// Orquestador principal del chat - coordina todos los dominios

import type { ChatContext, ChatDomain, ChatResponse, ChatResponseMetadata } from './types'
import { ChatResponseBuilder, createChatStream, StreamEncoder } from './ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../shared/openai'
import { logger } from '../shared/logger'
import { ChatError, handleError } from '../shared/errors'

// Importar dominios
import { getSearchDomain } from '../domains/search'
import { getVerificationDomain } from '../domains/verification'
import { getKnowledgeBaseDomain } from '../domains/knowledge-base'
import { getStatsDomain } from '../domains/stats'

/**
 * Orquestador principal del sistema de chat
 *
 * Coordina múltiples dominios especializados y decide cuál debe
 * manejar cada mensaje basándose en prioridades y capacidades.
 */
export class ChatOrchestrator {
  private domains: ChatDomain[] = []
  private systemPrompt: string

  constructor(systemPrompt?: string) {
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt()
  }

  /**
   * Registra un dominio en el orquestador
   */
  registerDomain(domain: ChatDomain): this {
    this.domains.push(domain)
    // Ordenar por prioridad (menor número = mayor prioridad)
    this.domains.sort((a, b) => a.priority - b.priority)
    logger.debug(`Domain registered: ${domain.name}`, { domain: 'orchestrator' })
    return this
  }

  /**
   * Procesa un mensaje y devuelve una respuesta
   */
  async process(context: ChatContext): Promise<ChatResponse> {
    const startTime = Date.now()

    logger.info('Processing chat request', {
      domain: 'orchestrator',
      userId: context.userId,
      hasQuestionContext: !!context.questionContext,
      domainCount: this.domains.length,
    })

    try {
      // Buscar dominio que pueda manejar el mensaje
      for (const domain of this.domains) {
        if (await domain.canHandle(context)) {
          logger.info(`Domain ${domain.name} handling request`, {
            domain: 'orchestrator',
          })

          const response = await domain.handle(context)
          response.metadata = {
            ...response.metadata,
            processingTime: Date.now() - startTime,
          }

          return response
        }
      }

      // Fallback: respuesta genérica con OpenAI
      logger.info('No domain matched, using fallback', { domain: 'orchestrator' })
      return this.fallbackResponse(context, startTime)
    } catch (error) {
      const chatError = handleError(error)
      logger.error('Error processing chat', chatError, { domain: 'orchestrator' })
      throw chatError
    }
  }

  /**
   * Procesa un mensaje y devuelve un stream
   */
  async processStream(context: ChatContext): Promise<ReadableStream> {
    const startTime = Date.now()

    logger.info('Processing streaming chat request', {
      domain: 'orchestrator',
      userId: context.userId,
      hasQuestionContext: !!context.questionContext,
      domainCount: this.domains.length,
    })

    try {
      // Buscar dominio que pueda manejar el mensaje
      for (const domain of this.domains) {
        const canHandle = await domain.canHandle(context)
        logger.debug(`Domain ${domain.name} canHandle: ${canHandle}`, { domain: 'orchestrator' })

        if (canHandle) {
          logger.info(`Domain ${domain.name} handling streaming request`, {
            domain: 'orchestrator',
          })

          // Procesar con el dominio y convertir a stream
          const response = await domain.handle(context)
          response.metadata = {
            ...response.metadata,
            processingTime: Date.now() - startTime,
          }

          // Convertir respuesta a stream (formato legacy)
          return this.responseToStream(response, context)
        }
      }

      // Fallback: streaming con OpenAI
      logger.info('No domain matched, using fallback stream', { domain: 'orchestrator' })
      return this.fallbackStream(context, startTime)
    } catch (error) {
      const chatError = handleError(error)
      const encoder = new StreamEncoder()

      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encodeError(chatError.message))
          controller.close()
        },
      })
    }
  }

  /**
   * Convierte una respuesta de dominio a stream
   */
  private responseToStream(response: ChatResponse, context: ChatContext): ReadableStream {
    const encoder = new StreamEncoder(true) // Legacy format

    return new ReadableStream({
      start(controller) {
        // 1. Metadata
        controller.enqueue(encoder.encodeMetadata(response.metadata || { domain: 'unknown' }))

        // 2. Contenido (enviamos todo de una vez, no es streaming real)
        controller.enqueue(encoder.encodeText(response.content))

        // 3. Done
        controller.enqueue(encoder.encodeDone({
          potentialErrorDetected: response.metadata?.verificationResult?.isCorrect === false,
          questionId: context.questionContext?.questionId,
          suggestions: null,
        }))

        controller.close()
      },
    })
  }

  /**
   * Respuesta fallback usando OpenAI directamente
   */
  private async fallbackResponse(
    context: ChatContext,
    startTime: number
  ): Promise<ChatResponse> {
    const openai = await getOpenAI()
    const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

    const messages = this.buildOpenAIMessages(context)

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    })

    const content = completion.choices[0]?.message?.content || 'No pude generar una respuesta.'

    return new ChatResponseBuilder()
      .domain('fallback')
      .text(content)
      .processingTime(Date.now() - startTime)
      .build()
  }

  /**
   * Stream fallback usando OpenAI directamente
   * Usa formato legacy compatible con el frontend actual
   */
  private async fallbackStream(
    context: ChatContext,
    startTime: number
  ): Promise<ReadableStream> {
    const openai = await getOpenAI()
    const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

    const messages = this.buildOpenAIMessages(context)

    const stream = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1500,
      stream: true,
    })

    // Usar formato legacy (compatible con frontend actual)
    const encoder = new StreamEncoder(true)
    const metadata: ChatResponseMetadata = {
      domain: 'fallback',
      processingTime: 0,
    }

    return new ReadableStream({
      async start(controller) {
        try {
          // 1. Enviar metadata primero (formato legacy: type: 'meta')
          controller.enqueue(encoder.encodeMetadata(metadata))

          // 2. Enviar contenido streamed (formato legacy: type: 'content')
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content
            if (content) {
              controller.enqueue(encoder.encodeText(content))
            }
          }

          // 3. Enviar done (formato legacy: type: 'done')
          controller.enqueue(encoder.encodeDone({
            potentialErrorDetected: false,
            questionId: context.questionContext?.questionId,
            suggestions: null,
          }))
        } catch (error) {
          logger.error('Stream error', error)
          controller.enqueue(encoder.encodeError(
            error instanceof Error ? error.message : 'Error desconocido'
          ))
        } finally {
          controller.close()
        }
      },
    })
  }

  /**
   * Construye los mensajes para OpenAI
   */
  private buildOpenAIMessages(context: ChatContext): Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: this.buildSystemPrompt(context) },
    ]

    // Añadir historial de conversación
    for (const msg of context.messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        })
      }
    }

    return messages
  }

  /**
   * Construye el system prompt con contexto
   */
  private buildSystemPrompt(context: ChatContext): string {
    let prompt = this.systemPrompt

    // Añadir contexto de pregunta si existe
    if (context.questionContext) {
      const qc = context.questionContext
      prompt += '\n\n### Contexto de la pregunta actual:\n'

      if (qc.questionText) {
        prompt += `Pregunta: ${qc.questionText}\n`
      }

      if (qc.options) {
        prompt += 'Opciones:\n'
        if (Array.isArray(qc.options)) {
          qc.options.forEach((opt, i) => {
            const letter = String.fromCharCode(65 + i)
            prompt += `${letter}) ${opt}\n`
          })
        } else {
          // options es objeto {a, b, c, d}
          const opts = qc.options as { a?: string; b?: string; c?: string; d?: string }
          if (opts.a) prompt += `A) ${opts.a}\n`
          if (opts.b) prompt += `B) ${opts.b}\n`
          if (opts.c) prompt += `C) ${opts.c}\n`
          if (opts.d) prompt += `D) ${opts.d}\n`
        }
      }

      if (qc.lawName) {
        prompt += `\nLey relacionada: ${qc.lawName}\n`
      }

      if (qc.articleNumber) {
        prompt += `Artículo: ${qc.articleNumber}\n`
      }

      if (qc.selectedAnswer !== undefined && qc.selectedAnswer !== null) {
        const selectedLetter = typeof qc.selectedAnswer === 'number'
          ? String.fromCharCode(65 + qc.selectedAnswer)
          : qc.selectedAnswer
        prompt += `\nEl usuario seleccionó: ${selectedLetter}\n`
      }

      if (qc.correctAnswer !== undefined && qc.correctAnswer !== null) {
        const correctLetter = typeof qc.correctAnswer === 'number'
          ? String.fromCharCode(65 + qc.correctAnswer)
          : qc.correctAnswer
        prompt += `Respuesta marcada como correcta: ${correctLetter}\n`
      }
    }

    return prompt
  }

  /**
   * System prompt por defecto
   */
  private getDefaultSystemPrompt(): string {
    return `Eres un asistente experto en oposiciones de Auxiliar Administrativo del Estado en España. 🎓

Tu objetivo es ayudar a los usuarios a prepararse para sus exámenes, explicando conceptos legales, resolviendo dudas sobre legislación y proporcionando información precisa basada en las leyes vigentes.

## 📝 Formato de respuestas

IMPORTANTE: Usa formato rico para que las respuestas sean claras y atractivas:
- **Negritas** para conceptos clave, plazos, y respuestas correctas
- Emojis relevantes: ✅ ❌ ⚠️ 📖 📌 💡 🔑 ⏰ 📋
- Listas con viñetas para enumerar opciones o pasos
- Separación clara entre secciones
- Citas de artículos en formato: **Art. X** de la *Ley Y*

## 📌 Directrices

- Sé claro y estructurado en tus respuestas
- **Cita siempre la fuente legal** cuando sea relevante (ley, artículo)
- Si no estás seguro de algo, indícalo claramente
- Usa un lenguaje formal pero accesible
- Si detectas un posible error en una pregunta de test, señálalo con "⚠️ **POSIBLE ERROR DETECTADO**"

## 📚 Leyes principales

- 🏛️ Constitución Española de 1978
- 📋 Ley 39/2015 del Procedimiento Administrativo Común
- ⚖️ Ley 40/2015 de Régimen Jurídico del Sector Público
- 🏢 Ley 50/1997 del Gobierno
- 🔍 Ley 19/2013 de Transparencia
- 👔 Real Decreto Legislativo 5/2015 del Estatuto Básico del Empleado Público

## 💡 Ejemplo de respuesta bien formateada

"La respuesta correcta es la **C) 3 años** ✅

📖 **Fundamento legal:**
Según el **Art. 9** de la *Ley Orgánica 2/1979*, del Tribunal Constitucional:
> El Presidente y Vicepresidente serán elegidos por un período de **tres años**.

🔑 **Puntos clave para recordar:**
- El mandato es de **3 años** (no 9 como los magistrados)
- Son elegidos por el **Pleno del TC**
- Nombrados formalmente por el **Rey**"`
  }
}

// Singleton del orquestador
let orchestratorInstance: ChatOrchestrator | null = null

/**
 * Obtiene la instancia del orquestador (singleton)
 */
export function getOrchestrator(): ChatOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new ChatOrchestrator()

    // Registrar dominios (se ordenan automáticamente por prioridad)
    orchestratorInstance.registerDomain(getVerificationDomain())   // Prioridad 1
    orchestratorInstance.registerDomain(getKnowledgeBaseDomain())  // Prioridad 2
    orchestratorInstance.registerDomain(getSearchDomain())         // Prioridad 3
    orchestratorInstance.registerDomain(getStatsDomain())          // Prioridad 4
  }
  return orchestratorInstance
}

/**
 * Reinicia el orquestador (útil para testing)
 */
export function resetOrchestrator(): void {
  orchestratorInstance = null
}
