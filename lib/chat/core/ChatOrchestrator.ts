// lib/chat/core/ChatOrchestrator.ts
// Orquestador principal del chat - coordina todos los dominios

import type { ChatContext, ChatDomain, ChatResponse, ChatResponseMetadata } from './types'
import { ChatResponseBuilder, createChatStream, StreamEncoder } from './ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../shared/openai'
import { getAnthropic, ANTHROPIC_MODEL } from '../shared/anthropic'
import { logger } from '../shared/logger'
import { ChatError, handleError } from '../shared/errors'
import { AITracer, createTracer } from './AITracer'

// Importar dominios
import { getSearchDomain } from '../domains/search'
import { getVerificationDomain } from '../domains/verification'
import { getKnowledgeBaseDomain } from '../domains/knowledge-base'
import { getTemarioDomain } from '../domains/temario/TemarioDomain'
import { getStatsDomain } from '../domains/stats'
import { getOposicionCatalogDomain } from '../domains/oposicion-catalog'
import { getPsychometricDomain } from '../domains/psychometric'
import { getAppHelpDomain } from '../domains/app-help/AppHelpDomain'
import { isPsychometricSubtype } from '../shared/constants'
import { isPlatformQuery } from '../domains/knowledge-base/queries'
import { generateEmbedding } from '../domains/search/EmbeddingService'
import { searchArticlesBySimilarity } from '../domains/search/queries'
import { createClient } from '@supabase/supabase-js'
import { FALLBACK_SYSTEM_PROMPT } from '../shared/prompts'

const getSupabaseForSearch = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Orquestador principal del sistema de chat
 *
 * Coordina múltiples dominios especializados y decide cuál debe
 * manejar cada mensaje basándose en prioridades y capacidades.
 */
export class ChatOrchestrator {
  private domains: ChatDomain[] = []
  private systemPrompt: string
  static cachedOposiciones: string | null = null
  static cacheTimestamp = 0
  static readonly CACHE_TTL = 1000 * 60 * 60 // 1 hora

  constructor(systemPrompt?: string) {
    this.systemPrompt = systemPrompt || this.getDefaultSystemPrompt()
  }

  /**
   * Carga oposiciones activas de BD para inyectar en el system prompt.
   * Cache de 1 hora para no consultar BD en cada mensaje.
   */
  static async loadOposiciones(): Promise<void> {
    const now = Date.now()
    if (ChatOrchestrator.cachedOposiciones && (now - ChatOrchestrator.cacheTimestamp) < ChatOrchestrator.CACHE_TTL) {
      return
    }

    try {
      const supabase = getSupabaseForSearch()
      const { data } = await supabase
        .from('oposiciones')
        .select('nombre, slug, plazas_libres, temas_count, exam_date, exam_date_approximate, estado_proceso, is_convocatoria_activa, grupo, subgrupo, titulo_requerido')
        .eq('is_active', true)
        .order('nombre')

      if (data?.length) {
        const lines = data.map(o => {
          let info = `- ${o.nombre} (/${o.slug})`
          if (o.subgrupo) info += ` [${o.subgrupo}]`
          if (o.titulo_requerido) info += ` (${o.titulo_requerido})`
          if (o.plazas_libres) info += ` — ${o.plazas_libres} plazas`
          if (o.temas_count) info += `, ${o.temas_count} temas`
          if (o.exam_date) {
            const fecha = new Date(o.exam_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
            info += `, examen ${o.exam_date_approximate ? '~' : ''}${fecha}`
          }
          if (o.estado_proceso) info += ` [${o.estado_proceso.replace(/_/g, ' ')}]`
          return info
        })

        // Generar resumen dinámico de subgrupos y titulaciones desde BD
        const bySubgrupo = new Map<string, { titulo: string, count: number }>()
        for (const o of data) {
          if (!o.subgrupo) continue
          const existing = bySubgrupo.get(o.subgrupo)
          if (!existing) {
            bySubgrupo.set(o.subgrupo, { titulo: o.titulo_requerido || '', count: 1 })
          } else {
            existing.count++
          }
        }

        let subgrupoSummary = ''
        if (bySubgrupo.size > 0) {
          subgrupoSummary = '\n\nSubgrupos disponibles en Vence:'
          // Ordenar: C2, C1, B, A2, A1
          const order = ['C2', 'C1', 'B', 'A2', 'A1']
          for (const sg of order) {
            const info = bySubgrupo.get(sg)
            if (info) {
              subgrupoSummary += `\n- ${sg}: ${info.count} oposiciones, requiere ${info.titulo}`
            }
          }
        }

        ChatOrchestrator.cachedOposiciones = lines.join('\n') + subgrupoSummary
        ChatOrchestrator.cacheTimestamp = now
        logger.info(`Loaded ${data.length} oposiciones for system prompt`, { domain: 'orchestrator' })
      }
    } catch (err) {
      logger.warn('Failed to load oposiciones for prompt', { domain: 'orchestrator' })
    }
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
   * @param context - Contexto del chat
   * @param logId - ID del log para vincular traces
   * @param options - Opciones adicionales
   * @param options.onFlush - Callback para manejar el flush de traces (usar con after() de Next.js)
   */
  async process(
    context: ChatContext,
    logId?: string,
    options?: { onFlush?: (flushFn: () => Promise<void>) => void }
  ): Promise<ChatResponse> {
    // Cargar oposiciones de BD (cache 1h, no bloquea si falla)
    await ChatOrchestrator.loadOposiciones()

    const startTime = Date.now()
    const tracer = createTracer()

    // Iniciar trace si tenemos logId
    if (logId) {
      tracer.startTrace(logId)
    }

    logger.info('Processing chat request', {
      domain: 'orchestrator',
      userId: context.userId,
      hasQuestionContext: !!context.questionContext,
      domainCount: this.domains.length,
    })

    // Span de routing - COMPLETO con contexto del usuario
    const routingSpan = tracer.spanRouting({
      evaluatedDomains: [],
      selectedDomain: null,
      confidence: 0,
      // Contexto completo de la request
      userMessage: context.currentMessage,
      userId: context.userId,
      isPremium: context.isPremium,
      userDomain: context.userDomain,
      conversationLength: context.messages.length,
      // Contexto de pregunta si existe
      hasQuestionContext: !!context.questionContext,
      questionContext: context.questionContext ? {
        questionId: context.questionContext.questionId,
        lawName: context.questionContext.lawName,
        questionText: context.questionContext.questionText,
        correctAnswer: context.questionContext.correctAnswer,
        selectedAnswer: context.questionContext.selectedAnswer,
        questionSubtype: context.questionContext.questionSubtype,
      } : null,
    })

    try {
      // ============================================
      // FAST-PATH: routing directo por tipo de contenido conocido
      // Si el tipo de pregunta determina el domain sin ambigüedad,
      // ir directo sin evaluar todos los domains.
      // ============================================
      if (isPsychometricSubtype(context.questionContext?.questionSubtype)) {
        const psychDomain = this.domains.find(d => d.name === 'psychometric')
        if (psychDomain) {
          routingSpan.setOutput({
            evaluatedDomains: [{ name: 'psychometric', priority: psychDomain.priority, canHandle: true, evalTimeMs: 0, reason: 'fast-path: psychometric subtype' }],
            selectedDomain: 'psychometric',
            confidence: 1.0
          })
          routingSpan.end()

          logger.info('Fast-path: PsychometricDomain (subtype detected)', { domain: 'orchestrator' })

          const response = await psychDomain.handle(context, tracer)
          if (response) {
            const duration = Date.now() - startTime
            logger.info(`Request completed via fast-path in ${duration}ms`, { domain: 'orchestrator' })
            await tracer.flush()
            return response
          }
          logger.info('Fast-path: PsychometricDomain returned null, falling through', { domain: 'orchestrator' })
        }
      }

      // Fast-path: verification cuando hay contexto de pregunta legislativa con respuesta
      // Si el usuario está en una pregunta y envía un follow-up, quiere saber sobre esa pregunta.
      // EXCEPCIÓN: si el mensaje es sobre la plataforma o pide crear un test nuevo, dejar routing normal.
      const isTestCreationRequest = /prep[aá]ra(me|nos)?\s+(un\s+)?test|hazme\s+(un\s+)?test|cr[eé]a(me)?\s+(un\s+)?test|quiero\s+(un\s+)?test|gen[eé]ra(me)?\s+(un\s+)?test/i.test(context.currentMessage)
      if (context.questionContext?.questionText &&
          context.questionContext?.correctAnswer !== undefined &&
          context.questionContext?.correctAnswer !== null &&
          !isPsychometricSubtype(context.questionContext?.questionSubtype) &&
          !isPlatformQuery(context.currentMessage) &&
          !isTestCreationRequest) {
        const verifyDomain = this.domains.find(d => d.name === 'verification')
        if (verifyDomain) {
          routingSpan.setOutput({
            evaluatedDomains: [{ name: 'verification', priority: verifyDomain.priority, canHandle: true, evalTimeMs: 0, reason: 'fast-path: question context with answer' }],
            selectedDomain: 'verification',
            confidence: 1.0
          })
          routingSpan.end()

          logger.info('Fast-path: VerificationDomain (question context detected)', { domain: 'orchestrator' })

          const response = await verifyDomain.handle(context, tracer)

          // Si VerificationDomain devuelve null (ej: pregunta de conocimiento sin correctAnswer),
          // continuar con routing normal para que otro domain (SearchDomain) lo maneje.
          if (response) {
            const duration = Date.now() - startTime
            logger.info(`Request completed via fast-path in ${duration}ms`, { domain: 'orchestrator' })
            await tracer.flush()
            return response
          }

          logger.info('Fast-path: VerificationDomain returned null, falling through to normal routing', { domain: 'orchestrator' })
        }
      }

      // Buscar dominio que pueda manejar el mensaje (routing normal)
      for (const domain of this.domains) {
        const evalStart = Date.now()
        const canHandle = await domain.canHandle(context)
        const evalTime = Date.now() - evalStart

        // Registrar evaluación del dominio
        const evaluatedDomains = (routingSpan.span?.input?.evaluatedDomains as Array<unknown>) || []
        evaluatedDomains.push({
          name: domain.name,
          priority: domain.priority,
          canHandle,
          evalTimeMs: evalTime,
          reason: (domain as any).getLastDecisionReason?.() || undefined
        })

        if (canHandle) {
          // Actualizar routing span con dominio seleccionado
          routingSpan.setOutput({
            evaluatedDomains,
            selectedDomain: domain.name,
            confidence: (domain as any).getConfidence?.() ?? 1.0
          })
          routingSpan.end()

          logger.info(`Domain ${domain.name} handling request`, {
            domain: 'orchestrator',
          })

          // Span de procesamiento del dominio
          const domainSpan = tracer.spanDomain(domain.name, {
            domain: domain.name,
            patternDetected: (domain as any).getLastPattern?.()?.type,
            patternConfidence: (domain as any).getLastPattern?.()?.confidence,
          })

          const response = await domain.handle(context, tracer)

          // Si el domain devuelve null, no pudo manejar el mensaje
          // (ej: KnowledgeBase matcheó keyword pero no encontró nada en BD).
          // Continuar al siguiente domain en prioridad.
          if (!response) {
            domainSpan.setOutput({ declined: true })
            domainSpan.end()
            logger.info(`Domain ${domain.name} returned null, trying next domain`, { domain: 'orchestrator' })
            continue
          }

          domainSpan.setOutput({
            responseLength: response.content?.length || 0,
            hasSources: !!response.metadata?.sources?.length,
            hasVerification: !!response.metadata?.verificationResult,
          })
          domainSpan.end()

          response.metadata = {
            domain: domain.name,
            ...response.metadata,
            processingTime: Date.now() - startTime,
          }

          // Flush traces - usar callback si existe, sino flush directo
          if (logId) {
            if (options?.onFlush) {
              options.onFlush(tracer.getFlushCallback())
            } else {
              await tracer.flush()
            }
          }

          return response
        }
      }

      // Ningún dominio matched
      routingSpan.setOutput({
        evaluatedDomains: routingSpan.span?.input?.evaluatedDomains || [],
        selectedDomain: 'fallback',
        confidence: 0
      })
      routingSpan.end()

      // Fallback: respuesta genérica con OpenAI
      logger.info('No domain matched, using fallback', { domain: 'orchestrator' })
      const response = await this.fallbackResponse(context, startTime, tracer)

      // Flush traces - usar callback si existe, sino flush directo
      if (logId) {
        if (options?.onFlush) {
          options.onFlush(tracer.getFlushCallback())
        } else {
          await tracer.flush()
        }
      }

      return response
    } catch (error) {
      const chatError = handleError(error)

      // Registrar error en trace
      tracer.spanError(chatError, {
        message: context.currentMessage,
        userId: context.userId,
      }).end()

      // Flush traces incluso en error - usar callback si existe
      if (logId) {
        if (options?.onFlush) {
          options.onFlush(tracer.getFlushCallback())
        } else {
          await tracer.flush()
        }
      }

      logger.error('Error processing chat', chatError, { domain: 'orchestrator' })
      throw chatError
    }
  }

  /**
   * Procesa un mensaje y devuelve un stream
   * @param context - Contexto del chat
   * @param logId - ID del log para vincular traces
   * @param options - Opciones adicionales
   * @param options.onFlush - Callback para manejar el flush de traces (usar con after() de Next.js)
   */
  async processStream(
    context: ChatContext,
    logId?: string,
    options?: { onFlush?: (flushFn: () => Promise<void>) => void }
  ): Promise<ReadableStream> {
    await ChatOrchestrator.loadOposiciones()

    const startTime = Date.now()
    const tracer = createTracer()

    // Iniciar trace si tenemos logId
    if (logId) {
      tracer.startTrace(logId)
    }

    logger.info('Processing streaming chat request', {
      domain: 'orchestrator',
      userId: context.userId,
      hasQuestionContext: !!context.questionContext,
      domainCount: this.domains.length,
    })

    // Span de routing - COMPLETO con contexto del usuario
    const routingSpan = tracer.spanRouting({
      evaluatedDomains: [],
      selectedDomain: null,
      confidence: 0,
      // Contexto completo de la request
      userMessage: context.currentMessage,
      userId: context.userId,
      isPremium: context.isPremium,
      userDomain: context.userDomain,
      conversationLength: context.messages.length,
      // Contexto de pregunta si existe
      hasQuestionContext: !!context.questionContext,
      questionContext: context.questionContext ? {
        questionId: context.questionContext.questionId,
        lawName: context.questionContext.lawName,
        questionText: context.questionContext.questionText,
        correctAnswer: context.questionContext.correctAnswer,
        selectedAnswer: context.questionContext.selectedAnswer,
        questionSubtype: context.questionContext.questionSubtype,
      } : null,
    })

    try {
      // Buscar dominio que pueda manejar el mensaje
      for (const domain of this.domains) {
        const evalStart = Date.now()
        const canHandle = await domain.canHandle(context)
        const evalTime = Date.now() - evalStart

        // Registrar evaluación del dominio
        const evaluatedDomains = (routingSpan.span?.input?.evaluatedDomains as Array<unknown>) || []
        evaluatedDomains.push({
          name: domain.name,
          priority: domain.priority,
          canHandle,
          evalTimeMs: evalTime,
        })

        logger.debug(`Domain ${domain.name} canHandle: ${canHandle}`, { domain: 'orchestrator' })

        if (canHandle) {
          // Actualizar routing span
          routingSpan.setOutput({
            evaluatedDomains,
            selectedDomain: domain.name,
            confidence: (domain as any).getConfidence?.() ?? 1.0
          })
          routingSpan.end()

          logger.info(`Domain ${domain.name} handling streaming request`, {
            domain: 'orchestrator',
          })

          // Span de procesamiento del dominio
          const domainSpan = tracer.spanDomain(domain.name, {
            domain: domain.name,
          })

          // Procesar con el dominio y convertir a stream
          const response = await domain.handle(context, tracer)

          if (!response) {
            domainSpan.setOutput({ declined: true })
            domainSpan.end()
            logger.info(`Domain ${domain.name} returned null in streaming, trying next`, { domain: 'orchestrator' })
            continue
          }

          domainSpan.setOutput({
            responseLength: response.content?.length || 0,
            hasSources: !!response.metadata?.sources?.length,
          })
          domainSpan.end()

          response.metadata = {
            domain: domain.name,
            ...response.metadata,
            processingTime: Date.now() - startTime,
          }

          // Flush traces - usar callback si existe, sino flush directo
          if (logId) {
            if (options?.onFlush) {
              options.onFlush(tracer.getFlushCallback())
            } else {
              await tracer.flush()
            }
          }

          // Convertir respuesta a stream (formato legacy)
          return this.responseToStream(response, context)
        }
      }

      // Ningún dominio matched
      routingSpan.setOutput({
        evaluatedDomains: routingSpan.span?.input?.evaluatedDomains || [],
        selectedDomain: 'fallback',
        confidence: 0
      })
      routingSpan.end()

      // Fallback: streaming con OpenAI
      logger.info('No domain matched, using fallback stream', { domain: 'orchestrator' })
      const stream = await this.fallbackStream(context, startTime, tracer)

      // Flush traces - usar callback si existe, sino flush directo
      if (logId) {
        if (options?.onFlush) {
          options.onFlush(tracer.getFlushCallback())
        } else {
          await tracer.flush()
        }
      }

      return stream
    } catch (error) {
      const chatError = handleError(error)

      // Registrar error en trace
      tracer.spanError(chatError, {
        message: context.currentMessage,
      }).end()

      // Flush traces - usar callback si existe, sino flush directo
      if (logId) {
        if (options?.onFlush) {
          options.onFlush(tracer.getFlushCallback())
        } else {
          await tracer.flush()
        }
      }

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
    startTime: number,
    tracer?: AITracer
  ): Promise<ChatResponse> {
    const openai = await getOpenAI()
    const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

    const messages = this.buildOpenAIMessages(context)

    // Grounding: RAG híbrido sobre legislación vigente
    await this.augmentMessagesWithFallbackRAG(context, messages, tracer)

    // Crear span LLM si hay tracer - COMPLETO sin truncar
    const llmSpan = tracer?.spanLLM({
      model,
      temperature: 0.7,
      maxTokens: 1500,
      // Prompts completos
      systemPrompt: messages[0]?.content || '',
      userPrompt: context.currentMessage,
      // Mensajes completos enviados a la API
      messagesArray: messages,
    })

    // Detectar terminología jurídica para usar Sonnet (más preciso en derecho)
    const LEGAL_TERMS = /\b(mayor[ií]a\s+(simple|absoluta|cualificada|de\s+miembros)|qu[oó]rum|veto|vetar|moci[oó]n|investidura|disoluci[oó]n|cese|cesa[rd]|destituci[oó]n|dimisi[oó]n|incompatibilidad|inhabilitaci[oó]n|aforamiento|inmunidad|inviolabilidad|prerrogativa|indulto|amnist[ií]a|decreto[- ]?ley|estado\s+de\s+(alarma|excepci[oó]n|sitio)|cuesti[oó]n\s+de\s+confianza|tribunal\s+constitucional|defensor\s+del\s+pueblo|consejo\s+de\s+estado)\b/i
    const isLegalConceptual = LEGAL_TERMS.test(context.currentMessage)

    let content: string
    let totalTokens: number | undefined
    let usedModel: string

    if (isLegalConceptual) {
      // Sonnet para preguntas conceptuales de derecho
      const anthropic = await getAnthropic()
      usedModel = ANTHROPIC_MODEL
      logger.info(`Fallback using Anthropic (legal conceptual query)`, { domain: 'orchestrator' })

      const anthropicMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const systemContent = messages.find(m => m.role === 'system')?.content || ''

      const response = await anthropic.messages.create({
        model: usedModel,
        system: systemContent,
        messages: anthropicMessages,
        temperature: 0.5,
        max_tokens: 1500,
      })

      content = response.content[0]?.type === 'text' ? response.content[0].text : 'No pude generar una respuesta.'
      totalTokens = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
    } else {
      // GPT-4o para el resto
      usedModel = model
      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1500,
      })

      content = completion.choices[0]?.message?.content || 'No pude generar una respuesta.'
      totalTokens = completion.usage?.total_tokens
    }

    // Finalizar span LLM - COMPLETO sin truncar
    llmSpan?.setOutput({
      responseContent: content,
      finishReason: 'stop',
      totalTokens,
    })
    llmSpan?.addMetadata('model', usedModel)
    llmSpan?.addMetadata('responseLength', content.length)
    llmSpan?.addMetadata('isLegalConceptual', isLegalConceptual)
    llmSpan?.end()

    const builder = new ChatResponseBuilder()
      .domain('fallback')
      .text(content)
      .processingTime(Date.now() - startTime)

    if (totalTokens) {
      builder.tokensUsed(totalTokens)
    }

    return builder.build()
  }

  /**
   * Stream fallback usando OpenAI directamente
   * Usa formato legacy compatible con el frontend actual
   */
  private async fallbackStream(
    context: ChatContext,
    startTime: number,
    tracer?: AITracer
  ): Promise<ReadableStream> {
    const openai = await getOpenAI()
    const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

    const messages = this.buildOpenAIMessages(context)

    // Grounding: RAG híbrido sobre legislación vigente
    await this.augmentMessagesWithFallbackRAG(context, messages, tracer)

    // Crear span LLM si hay tracer - COMPLETO sin truncar
    const llmSpan = tracer?.spanLLM({
      model,
      temperature: 0.7,
      maxTokens: 1500,
      // Prompts completos
      systemPrompt: messages[0]?.content || '',
      userPrompt: context.currentMessage,
      // Mensajes completos enviados a la API
      messagesArray: messages,
    })

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

    // Acumular contenido para trace
    let fullContent = ''

    return new ReadableStream({
      async start(controller) {
        try {
          // 1. Enviar metadata primero (formato legacy: type: 'meta')
          controller.enqueue(encoder.encodeMetadata(metadata))

          // 2. Enviar contenido streamed (formato legacy: type: 'content')
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content
            if (content) {
              fullContent += content
              controller.enqueue(encoder.encodeText(content))
            }
          }

          // Finalizar span LLM con contenido completo - SIN truncar
          llmSpan?.setOutput({
            responseContent: fullContent,
            finishReason: 'stop',
          })
          llmSpan?.addMetadata('model', model)
          llmSpan?.addMetadata('responseLength', fullContent.length)
          llmSpan?.end()

          // 3. Enviar done (formato legacy: type: 'done')
          controller.enqueue(encoder.encodeDone({
            potentialErrorDetected: false,
            questionId: context.questionContext?.questionId,
            suggestions: null,
          }))
        } catch (error) {
          llmSpan?.setError(error instanceof Error ? error.message : 'Unknown error')
          llmSpan?.end()

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
   * Grounding para fallback: ejecuta RAG híbrido (embedding + full-text) sobre
   * legislación vigente y añade los artículos encontrados al system prompt.
   *
   * Mejoras 2026-04-14 tras auditoría sycophancy:
   * - (a) Aumenta la query con los últimos turnos de conversación cuando el
   *   mensaje actual es un follow-up corto (pronombres, "y...", "no es...",
   *   "seguro?"), para que el RAG encuentre los artículos referenciados en
   *   turnos anteriores.
   * - (b) Emite un trace de spanDB('fallbackHybridSearch') con los artículos
   *   recuperados, para permitir auditar el grounding en revisiones futuras.
   *
   * Compartido entre fallbackResponse (no-streaming) y fallbackStream.
   */
  private async augmentMessagesWithFallbackRAG(
    context: ChatContext,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    tracer?: AITracer
  ): Promise<void> {
    try {
      // (a) Follow-up detection: ¿el mensaje actual depende del historial?
      const msgTrim = context.currentMessage.trim()
      const isFollowUpLike =
        msgTrim.length < 120 &&
        /^(\?|y\s|y\b|no\b|no\s|entonces\b|ose[ae]\b|pero\b|por\s*qu[eé]\b|seguro\??$|est[aá]s?\s+segur|ya\s+pero|creo\s+que|no\s+es\s+esto)/i.test(msgTrim)

      let queryText = context.currentMessage
      if (isFollowUpLike && context.messages && context.messages.length > 1) {
        const lastTurns = context.messages.slice(-6)
        const extra = lastTurns
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => m.content || '')
          .join(' ')
          .slice(0, 1500)
        queryText = `${context.currentMessage} ${extra}`
        logger.info('Fallback RAG: augmented query with conversation history', {
          domain: 'orchestrator',
          originalLen: context.currentMessage.length,
          augmentedLen: queryText.length,
        })
      }

      const { embedding } = await generateEmbedding(queryText)

      // Leyes prioritarias del temario del usuario
      let priorityLawIds: string[] = []
      if (context.userDomain) {
        try {
          const domainNorm = context.userDomain.replace(/-/g, '_')
          const { data: scopeLaws } = await getSupabaseForSearch()
            .from('topic_scope')
            .select('law_id, topics!inner(position_type)')
            .eq('topics.position_type', domainNorm)
          if (scopeLaws && scopeLaws.length > 0) {
            priorityLawIds = [...new Set(scopeLaws.map((s: Record<string, unknown>) => s.law_id as string))]
            logger.info(`Fallback RAG: ${priorityLawIds.length} priority laws for ${context.userDomain}`, { domain: 'orchestrator' })
          }
        } catch { /* no bloquear si falla */ }
      }

      // (b) Trace de auditoría del RAG
      const ragSpan = tracer?.spanDB('fallbackHybridSearch', {
        userMessage: context.currentMessage,
        augmentedQuery: queryText !== context.currentMessage ? queryText.slice(0, 500) : undefined,
        isFollowUpLike,
        userDomain: context.userDomain,
        priorityLawCount: priorityLawIds.length,
      })

      const { data: hybridResults } = await getSupabaseForSearch().rpc('hybrid_search_articles', {
        query_embedding: embedding,
        query_text: queryText,
        match_count: 15,
        semantic_weight: 0.4,
        text_weight: 0.6,
        priority_law_ids: priorityLawIds,
      })

      const allArticles = hybridResults || []

      ragSpan?.setOutput({
        articlesFound: allArticles.length,
        articles: (allArticles as Array<Record<string, unknown>>).slice(0, 8).map(a => ({
          lawName: a.law_short_name,
          articleNumber: a.article_number,
          title: a.title,
        })),
      })
      ragSpan?.end()

      if (allArticles.length === 0) return

      // Diversificar: máximo 2 artículos por ley
      const byLaw = new Map<string, number>()
      const diversified = (allArticles as Array<Record<string, unknown>>).filter(a => {
        const lawKey = (a.law_short_name || 'unknown') as string
        const count = byLaw.get(lawKey) || 0
        if (count >= 2) return false
        byLaw.set(lawKey, count + 1)
        return true
      }).slice(0, 8)

      // Expandir query con sinónimos legales
      const LEGAL_SYNONYMS: Record<string, string[]> = {
        paternidad: ['progenitor', 'padre', 'nacimiento'],
        maternidad: ['progenitora', 'madre', 'nacimiento', 'biologica'],
        vacaciones: ['descanso', 'permiso', 'dias'],
        despido: ['cese', 'extincion', 'separacion'],
        sueldo: ['retribucion', 'salario', 'remuneracion'],
        jefe: ['superior', 'director', 'responsable'],
        multa: ['sancion', 'infraccion', 'penalidad'],
        contrato: ['convenio', 'acuerdo', 'pacto'],
        recurso: ['impugnacion', 'reclamacion', 'alzada'],
        plazo: ['termino', 'periodo', 'duracion'],
      }

      const baseWords = context.currentMessage
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3)
        .map(w => w.replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u'))
      const expandedWords = new Set(baseWords)
      for (const w of baseWords) {
        const syns = LEGAL_SYNONYMS[w]
        if (syns) syns.forEach(s => expandedWords.add(s))
      }
      const queryWords = [...expandedWords]

      const articlesContext = diversified.map(a => {
        const content = String(a.content || '')
        const header = `--- ${a.law_short_name || ''} Art. ${a.article_number} ${a.title ? '- ' + a.title : ''} ---`
        if (content.length <= 2500) return `${header}\n${content}`

        const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20)
        const scored = paragraphs.map((p, idx) => {
          const pNorm = p.toLowerCase().replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u')
          let score = 0
          for (const w of queryWords) {
            if (pNorm.includes(w)) score += 1
          }
          if (idx === 0) score += 0.5
          return { p, score, idx }
        })
        const relevant = scored
          .filter(s => s.score > 0)
          .sort((a, b) => b.score - a.score || a.idx - b.idx)
          .slice(0, 8)
          .sort((a, b) => a.idx - b.idx)
        const selected = relevant.length > 0 ? relevant.map(r => r.p) : paragraphs.slice(0, 3)
        const extracted = selected.join('\n\n')
        return `${header}\n${extracted.length > 3000 ? extracted.substring(0, 3000) : extracted}`
      }).join('\n\n')

      const systemIdx = messages.findIndex(m => m.role === 'system')
      if (systemIdx >= 0) {
        messages[systemIdx].content += `\n\n📖 LEGISLACIÓN VIGENTE (${diversified.length} artículos de ${byLaw.size} leyes):

⚠️ INSTRUCCIÓN OBLIGATORIA:
1. Los artículos de abajo son legislación VIGENTE y ACTUALIZADA. SIEMPRE tienen prioridad sobre lo que recuerdes de tu entrenamiento.
2. Si un artículo dice "diecinueve semanas", la respuesta es 19 semanas. NO uses datos de tu entrenamiento que puedan estar desactualizados.
3. Cita SIEMPRE la ley y artículo exacto de donde sacas el dato.
4. Si el usuario aporta datos contradictorios (cifras, fechas) sin cita, contrasta con los artículos siguientes. Si no figuran allí, dilo abiertamente: "No tengo esa información confirmada en la base de datos" en lugar de aceptarlos sin más.

${articlesContext}`
      }

      logger.info(`Fallback RAG hybrid: ${diversified.length} articles from ${byLaw.size} laws`, {
        domain: 'orchestrator',
        laws: [...byLaw.keys()],
      })
    } catch (ragError) {
      logger.warn('Fallback RAG failed, continuing without articles', { domain: 'orchestrator', error: String(ragError) })
    }
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

    // Inyectar oposiciones activas desde cache
    if (prompt.includes('{{OPOSICIONES_ACTIVAS}}')) {
      const opoList = ChatOrchestrator.cachedOposiciones || '- Auxiliar Administrativo del Estado, Administrativo del Estado, y más'
      prompt = prompt.replace('{{OPOSICIONES_ACTIVAS}}', opoList)
    }

    // Añadir contexto de pregunta si existe (solo para preguntas no-psicotécnicas;
    // las psicotécnicas son manejadas por PsychometricDomain antes de llegar aquí)
    if (context.questionContext) {
      const qc = context.questionContext

      // Obtener opciones como objeto
      let options: { a?: string; b?: string; c?: string; d?: string } = {}
      if (qc.options) {
        if (Array.isArray(qc.options)) {
          options = {
            a: qc.options[0],
            b: qc.options[1],
            c: qc.options[2],
            d: qc.options[3],
          }
        } else {
          options = qc.options as { a?: string; b?: string; c?: string; d?: string }
        }
      }

      // Obtener letra de respuesta correcta
      const correctLetter = qc.correctAnswer !== undefined && qc.correctAnswer !== null
        ? (typeof qc.correctAnswer === 'number'
          ? String.fromCharCode(65 + qc.correctAnswer)
          : qc.correctAnswer)
        : null

      // Contexto normal para preguntas de leyes
      prompt += '\n\n### Contexto de la pregunta actual:\n'

      if (qc.questionText) {
        prompt += `Pregunta: ${qc.questionText}\n`
      }

      if (qc.options) {
        prompt += 'Opciones:\n'
        if (options.a) prompt += `A) ${options.a}\n`
        if (options.b) prompt += `B) ${options.b}\n`
        if (options.c) prompt += `C) ${options.c}\n`
        if (options.d) prompt += `D) ${options.d}\n`
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

      if (correctLetter) {
        prompt += `Respuesta marcada como correcta: ${correctLetter}\n`
      }
    }

    return prompt
  }

  /**
   * System prompt por defecto
   */
  private getDefaultSystemPrompt(): string {
    return FALLBACK_SYSTEM_PROMPT
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
    orchestratorInstance.registerDomain(getPsychometricDomain())   // Prioridad 1.5
    orchestratorInstance.registerDomain(getAppHelpDomain())        // Prioridad 1.7
    orchestratorInstance.registerDomain(getKnowledgeBaseDomain())  // Prioridad 2
    orchestratorInstance.registerDomain(getTemarioDomain())        // Prioridad 2.5
    orchestratorInstance.registerDomain(getSearchDomain())            // Prioridad 3
    orchestratorInstance.registerDomain(getOposicionCatalogDomain())  // Prioridad 3.5
    orchestratorInstance.registerDomain(getStatsDomain())             // Prioridad 4
  }
  return orchestratorInstance
}

/**
 * Reinicia el orquestador (útil para testing)
 */
export function resetOrchestrator(): void {
  orchestratorInstance = null
}
