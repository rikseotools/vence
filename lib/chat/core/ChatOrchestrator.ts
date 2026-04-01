// lib/chat/core/ChatOrchestrator.ts
// Orquestador principal del chat - coordina todos los dominios

import type { ChatContext, ChatDomain, ChatResponse, ChatResponseMetadata } from './types'
import { ChatResponseBuilder, createChatStream, StreamEncoder } from './ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../shared/openai'
import { logger } from '../shared/logger'
import { ChatError, handleError } from '../shared/errors'
import { AITracer, createTracer } from './AITracer'

// Importar dominios
import { getSearchDomain } from '../domains/search'
import { getVerificationDomain } from '../domains/verification'
import { getKnowledgeBaseDomain } from '../domains/knowledge-base'
import { getTemarioDomain } from '../domains/temario/TemarioDomain'
import { getStatsDomain } from '../domains/stats'
import { getPsychometricDomain } from '../domains/psychometric'
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
          const duration = Date.now() - startTime
          logger.info(`Request completed via fast-path in ${duration}ms`, { domain: 'orchestrator' })
          await tracer.flush()
          return response
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

    // RAG híbrido: busca artículos por embedding + full-text (keywords)
    // Combina ambos scores para encontrar artículos relevantes incluso
    // cuando la query coloquial no matchea semánticamente con el texto legal.
    try {
      const { embedding } = await generateEmbedding(context.currentMessage)

      // Obtener leyes prioritarias del temario del usuario
      let priorityLawIds: string[] = []
      if (context.userDomain) {
        try {
          // userDomain puede ser slug (auxiliar-administrativo-estado) o position_type (auxiliar_administrativo)
          const domainNorm = context.userDomain.replace(/-/g, '_')
          // Buscar topics que matcheen (position_type puede no tener _estado)
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

      // Búsqueda híbrida (embedding + full-text con OR + boost por oposición)
      const { data: hybridResults } = await getSupabaseForSearch().rpc('hybrid_search_articles', {
        query_embedding: embedding,
        query_text: context.currentMessage,
        match_count: 15,
        semantic_weight: 0.4,
        text_weight: 0.6,
        priority_law_ids: priorityLawIds,
      })

      const allArticles = hybridResults || []

      if (allArticles.length > 0) {
        // Diversificar: máximo 2 artículos por ley para cubrir más fuentes
        const byLaw = new Map<string, number>()
        const diversified = allArticles.filter((a: Record<string, unknown>) => {
          const lawKey = (a.law_short_name || 'unknown') as string
          const count = byLaw.get(lawKey) || 0
          if (count >= 2) return false
          byLaw.set(lawKey, count + 1)
          return true
        }).slice(0, 8)

        // Extraer párrafos relevantes de cada artículo (chunking por párrafo)
        // Escalable: funciona con artículos de cualquier longitud.
        // Expande keywords con sinónimos legales para encontrar párrafos relevantes
        // aunque usen terminología diferente (ej: "paternidad" → "progenitor")
        const LEGAL_SYNONYMS: Record<string, string[]> = {
          'paternidad': ['progenitor', 'padre', 'nacimiento'],
          'maternidad': ['progenitora', 'madre', 'nacimiento', 'biologica'],
          'vacaciones': ['descanso', 'permiso', 'dias'],
          'despido': ['cese', 'extincion', 'separacion'],
          'sueldo': ['retribucion', 'salario', 'remuneracion'],
          'jefe': ['superior', 'director', 'responsable'],
          'multa': ['sancion', 'infraccion', 'penalidad'],
          'contrato': ['convenio', 'acuerdo', 'pacto'],
          'recurso': ['impugnacion', 'reclamacion', 'alzada'],
          'plazo': ['termino', 'periodo', 'duracion'],
        }

        const baseWords = context.currentMessage.toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 3)
          .map(w => w.replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u'))

        // Expandir con sinónimos
        const expandedWords = new Set(baseWords)
        for (const w of baseWords) {
          const synonyms = LEGAL_SYNONYMS[w]
          if (synonyms) synonyms.forEach(s => expandedWords.add(s))
        }
        const queryWords = [...expandedWords]

        const articlesContext = diversified.map((a: Record<string, unknown>) => {
          const content = String(a.content || '')
          const header = `--- ${a.law_short_name || ''} Art. ${a.article_number} ${a.title ? '- ' + a.title : ''} ---`

          // Artículos cortos: pasar completos
          if (content.length <= 2500) return `${header}\n${content}`

          // Artículos largos: extraer párrafos relevantes por score
          const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20)
          const scored = paragraphs.map((p, idx) => {
            const pNorm = p.toLowerCase()
              .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u')
            let score = 0
            for (const w of queryWords) {
              if (pNorm.includes(w)) score += 1
            }
            // Bonus para primeros párrafos (suelen tener contexto)
            if (idx === 0) score += 0.5
            return { p, score, idx }
          })

          // Ordenar por score y tomar los mejores párrafos
          // Priorizar párrafos con más keywords y que sean encabezados de apartado (a), b), c)...)
          const relevant = scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score || a.idx - b.idx)
            .slice(0, 8)
            .sort((a, b) => a.idx - b.idx) // Reordenar por posición original

          // Si no hay párrafos relevantes, tomar los primeros
          const selected = relevant.length > 0
            ? relevant.map(r => r.p)
            : paragraphs.slice(0, 3)

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
4. Si no encuentras la respuesta en los artículos, di que no tienes suficiente información en la base de datos.

${articlesContext}`
        }

        logger.info(`Fallback RAG hybrid: ${diversified.length} articles from ${byLaw.size} laws`, {
          domain: 'orchestrator',
          laws: [...byLaw.keys()],
        })
      }
    } catch (ragError) {
      logger.warn('Fallback RAG failed, continuing without articles', { domain: 'orchestrator' })
    }

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

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1500,
    })

    const content = completion.choices[0]?.message?.content || 'No pude generar una respuesta.'
    const totalTokens = completion.usage?.total_tokens

    // Finalizar span LLM - COMPLETO sin truncar
    llmSpan?.setOutput({
      responseContent: content,
      finishReason: completion.choices[0]?.finish_reason,
      promptTokens: completion.usage?.prompt_tokens,
      completionTokens: completion.usage?.completion_tokens,
      totalTokens,
    })
    llmSpan?.addMetadata('tokensIn', completion.usage?.prompt_tokens)
    llmSpan?.addMetadata('tokensOut', completion.usage?.completion_tokens)
    llmSpan?.addMetadata('model', model)
    llmSpan?.addMetadata('responseLength', content.length)
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
    orchestratorInstance.registerDomain(getKnowledgeBaseDomain())  // Prioridad 2
    orchestratorInstance.registerDomain(getTemarioDomain())        // Prioridad 2.5
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
