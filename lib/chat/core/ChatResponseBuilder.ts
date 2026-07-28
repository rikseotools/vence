// lib/chat/core/ChatResponseBuilder.ts
// Builder para respuestas de chat con streaming

import type { ChatResponse, ChatResponseMetadata, ArticleSource, StreamChunk } from './types'
import { logger } from '../shared/logger'

/**
 * Builder para construir respuestas de chat de forma fluida
 */
export class ChatResponseBuilder {
  private content: string[] = []
  private metadata: ChatResponseMetadata = { domain: 'unknown' }
  private sources: ArticleSource[] = []

  /**
   * Establece el dominio que generó la respuesta
   */
  domain(name: string): this {
    this.metadata.domain = name
    return this
  }

  /**
   * Añade texto a la respuesta
   */
  text(content: string): this {
    this.content.push(content)
    return this
  }

  /**
   * Añade un párrafo (con doble salto de línea)
   */
  paragraph(content: string): this {
    if (this.content.length > 0) {
      this.content.push('\n\n')
    }
    this.content.push(content)
    return this
  }

  /**
   * Añade una lista con viñetas
   */
  bulletList(items: string[]): this {
    const list = items.map(item => `• ${item}`).join('\n')
    return this.paragraph(list)
  }

  /**
   * Añade una fuente/referencia
   */
  addSource(source: ArticleSource): this {
    this.sources.push(source)
    return this
  }

  /**
   * Añade múltiples fuentes
   */
  addSources(sources: ArticleSource[]): this {
    this.sources.push(...sources)
    // Las fuentes van a metadata AQUÍ, no solo en `withSourcesBlock()`.
    //
    // Antes solo se guardaban al pintar el bloque visible, y `VerificationDomain` NO lo pinta a
    // propósito («para no mostrar fuentes al usuario»): quería las fuentes en los metadatos sin
    // enseñarlas, y el único camino que las guardaba era justo el que las enseñaba. Resultado:
    // **se perdían**. Por eso las trazas decían `hasSources: false` teniendo artículos, y
    // `ai_chat_logs.sources_used` y `detected_laws` salían vacíos en respuestas que sí citaban
    // el artículo correcto (visto en los ciclos 1, 2 y 5 de la revisión de negativos, 28/07/2026).
    //
    // Separar las dos cosas es lo correcto: `addSources` = «tengo estas fuentes» (dato),
    // `withSourcesBlock` = «además, píntalas» (presentación).
    this.metadata.sources = [...this.sources]
    return this
  }

  /**
   * Añade el bloque de fuentes al final
   */
  withSourcesBlock(): this {
    if (this.sources.length > 0) {
      const sourcesText = this.sources
        .map(s => `📖 ${s.lawName}, Art. ${s.articleNumber}${s.title ? ` - ${s.title}` : ''}`)
        .join('\n')
      this.paragraph(`**Fuentes:**\n${sourcesText}`)
    }
    this.metadata.sources = this.sources
    return this
  }

  /**
   * Establece el resultado de verificación
   */
  verification(result: ChatResponseMetadata['verificationResult']): this {
    this.metadata.verificationResult = result
    return this
  }

  /**
   * Establece el número de tokens usados
   */
  tokensUsed(n: number): this {
    this.metadata.tokensUsed = n
    return this
  }

  /**
   * Establece el modelo LLM usado (provider + id) para métricas por modelo
   */
  model(provider: string, id: string): this {
    this.metadata.modelProvider = provider
    this.metadata.modelId = id
    return this
  }

  /**
   * Establece el tiempo de procesamiento
   */
  processingTime(ms: number): this {
    this.metadata.processingTime = ms
    return this
  }

  /**
   * Construye la respuesta final
   */
  build(): ChatResponse {
    return {
      content: this.content.join(''),
      // Copia, no la referencia: devolver `this.metadata` hacía que seguir usando el builder
      // (otro `addSources`, otro `reset`) mutara una respuesta YA entregada. No había pasado
      // todavía, pero es la clase de borde que aparece el día que alguien reutilice el builder.
      metadata: { ...this.metadata },
    }
  }

  /**
   * Reinicia el builder
   */
  reset(): this {
    this.content = []
    this.metadata = { domain: 'unknown' }
    this.sources = []
    return this
  }
}

/**
 * Encoder para streaming de respuestas
 * Soporta formato nuevo (v2) y formato legacy (compatible con frontend actual)
 */
export class StreamEncoder {
  private encoder = new TextEncoder()
  private useLegacyFormat: boolean

  constructor(useLegacyFormat: boolean = true) {
    this.useLegacyFormat = useLegacyFormat
  }

  /**
   * Codifica un chunk para enviar por el stream
   */
  encode(chunk: StreamChunk): Uint8Array {
    const data = JSON.stringify(chunk)
    return this.encoder.encode(`data: ${data}\n\n`)
  }

  /**
   * Codifica datos raw como JSON
   */
  encodeRaw(data: Record<string, unknown>): Uint8Array {
    return this.encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
  }

  /**
   * Codifica texto plano
   * Legacy: { type: 'content', content: text }
   * V2: { type: 'text', content: text }
   */
  encodeText(text: string): Uint8Array {
    if (this.useLegacyFormat) {
      return this.encodeRaw({ type: 'content', content: text })
    }
    return this.encode({ type: 'text', content: text })
  }

  /**
   * Codifica metadata inicial (sources, searchMethod, etc.)
   * Legacy: { type: 'meta', sources: [...], searchMethod: '...' }
   * V2: { type: 'metadata', metadata: {...} }
   */
  encodeMetadata(metadata: ChatResponseMetadata): Uint8Array {
    if (this.useLegacyFormat) {
      return this.encodeRaw({
        type: 'meta',
        sources: metadata.sources?.map(s => ({
          law: s.lawName,
          article: s.articleNumber,
          title: s.title,
        })) || [],
        searchMethod: metadata.domain,
        detectedPattern: null,
        tokensUsed: metadata.tokensUsed || null,
        modelProvider: metadata.modelProvider || null,
        modelId: metadata.modelId || null,
      })
    }
    return this.encode({ type: 'metadata', metadata })
  }

  /**
   * Codifica error
   */
  encodeError(error: string): Uint8Array {
    return this.encodeRaw({ type: 'error', error })
  }

  /**
   * Codifica fin de stream
   * Legacy: { type: 'done', potentialErrorDetected, questionId, suggestions }
   * V2: { type: 'done' }
   */
  encodeDone(options?: {
    potentialErrorDetected?: boolean
    questionId?: string | null
    suggestions?: string[] | null
  }): Uint8Array {
    if (this.useLegacyFormat) {
      return this.encodeRaw({
        type: 'done',
        potentialErrorDetected: options?.potentialErrorDetected || false,
        autoDisputeCreated: false,
        questionId: options?.questionId || null,
        suggestions: options?.suggestions || null,
      })
    }
    return this.encode({ type: 'done' })
  }

  /**
   * Codifica logId (solo legacy)
   */
  encodeLogId(logId: string): Uint8Array {
    return this.encodeRaw({ type: 'logId', logId })
  }
}

/**
 * Crea un ReadableStream para respuestas de chat
 */
export function createChatStream(
  generator: AsyncGenerator<string, void, unknown>,
  metadata?: ChatResponseMetadata
): ReadableStream {
  const encoder = new StreamEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encodeText(chunk))
        }

        if (metadata) {
          controller.enqueue(encoder.encodeMetadata(metadata))
        }

        controller.enqueue(encoder.encodeDone())
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
 * Wrapper para streaming de OpenAI
 */
export async function* streamOpenAIResponse(
  stream: AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>
): AsyncGenerator<string, void, unknown> {
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content
    if (content) {
      yield content
    }
  }
}
