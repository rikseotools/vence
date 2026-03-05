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
   * Detecta si es una pregunta psicotécnica basándose en el questionSubtype
   */
  private isPsychometricQuestion(context: ChatContext): boolean {
    const PSYCHOMETRIC_SUBTYPES = [
      'bar_chart', 'pie_chart', 'line_chart', 'mixed_chart',
      'data_tables', 'error_detection',
      'sequence_numeric', 'sequence_letter', 'sequence_alphanumeric',
      'word_analysis'
    ]
    const subtype = context.questionContext?.questionSubtype
    return subtype ? PSYCHOMETRIC_SUBTYPES.includes(subtype) : false
  }

  /**
   * Construye el system prompt con contexto
   */
  private buildSystemPrompt(context: ChatContext): string {
    const isPsychometric = this.isPsychometricQuestion(context)

    // Usar prompt específico para psicotécnicos
    let prompt = isPsychometric ? this.getPsychometricSystemPrompt() : this.systemPrompt

    // Añadir contexto de pregunta si existe
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
      const correctText = correctLetter
        ? options[correctLetter.toLowerCase() as 'a' | 'b' | 'c' | 'd'] || ''
        : ''

      if (isPsychometric) {
        // Extraer información adicional del contentData según el tipo de pregunta
        const contentData = qc.contentData as Record<string, unknown> | undefined
        const subtype = qc.questionSubtype || ''

        // Extraer explicación según el tipo de pregunta
        let additionalContext = ''
        let savedExplanation = qc.explanation || ''

        if (contentData) {
          // Para gráficos (bar_chart, pie_chart, line_chart, mixed_chart)
          const explanationSections = contentData.explanation_sections as Array<{ title: string; content: string }> | undefined
          if (explanationSections?.[0]?.content) {
            savedExplanation = explanationSections[0].content
          }

          // Para series numéricas
          if (subtype === 'sequence_numeric' && contentData.solution_method) {
            additionalContext += `\nMétodo de solución: ${contentData.solution_method}`
          }

          // Para series alfabéticas
          if ((subtype === 'sequence_letter' || subtype === 'sequence_alphanumeric') && contentData.pattern_description) {
            additionalContext += `\nTipo de patrón: ${contentData.pattern_description}`
          }

          // Para detección de errores ortográficos
          if (subtype === 'error_detection') {
            if (contentData.original_text) {
              additionalContext += `\nTexto a analizar: "${contentData.original_text}"`
            }
            if (contentData.correct_text) {
              additionalContext += `\nTexto corregido: "${contentData.correct_text}"`
            }
            const errorsFound = contentData.errors_found as Array<{ incorrect: string; correct: string; explanation: string }> | undefined
            if (errorsFound?.length) {
              additionalContext += '\nErrores encontrados:'
              errorsFound.forEach(e => {
                additionalContext += `\n  • "${e.incorrect}" → "${e.correct}" (${e.explanation})`
              })
            }
          }

          // Para análisis de palabras
          if (subtype === 'word_analysis' && contentData.original_text) {
            additionalContext += `\nTexto/Palabras a analizar: "${contentData.original_text}"`
          }
        }

        // Contexto específico para psicotécnicos con verificación
        prompt += `

PREGUNTA DE PSICOTÉCNICO:
Tipo: ${qc.questionTypeName || qc.questionSubtype || 'General'}

Pregunta: ${qc.questionText || 'Sin texto'}${additionalContext}

Opciones:
A) ${options.a || 'Sin opción'}
B) ${options.b || 'Sin opción'}
C) ${options.c || 'Sin opción'}
D) ${options.d || 'Sin opción'}

⭐ RESPUESTA CORRECTA: ${correctLetter}) ${correctText}
${savedExplanation ? `\n📖 EXPLICACIÓN DE LA SOLUCIÓN:\n${savedExplanation}` : ''}

⚠️ INSTRUCCIONES CRÍTICAS - VERIFICACIÓN DE PSICOTÉCNICOS:

PASO 1 - RESUELVE TÚ MISMO EL EJERCICIO:
- Analiza los datos proporcionados (serie, gráfico, tabla, etc.)
- Encuentra el patrón o realiza los cálculos necesarios
- Determina cuál es la respuesta correcta según TU análisis matemático/lógico

PASO 2 - COMPARA CON LA RESPUESTA MARCADA:
- Esta pregunta da por buena: ${correctLetter}) ${correctText}
- Si TU respuesta (del paso 1) es DIFERENTE a ${correctLetter}:
  → Di: "⚠️ POSIBLE ERROR DETECTADO: Esta pregunta da por buena la opción ${correctLetter}, pero según mi análisis [explica el razonamiento], la respuesta correcta debería ser [tu respuesta]"
- Si TU respuesta coincide con ${correctLetter}:
  → Confirma que es correcta y explica el razonamiento paso a paso

FORMATO DE EXPLICACIÓN:
1. Muestra el análisis paso a paso (cálculos, patrón encontrado, etc.)
2. Indica claramente la respuesta: **🎯 Respuesta: X**
3. Enseña la ESTRATEGIA para resolver este tipo de ejercicios

REGLAS ABSOLUTAS:
- HAZ los cálculos tú mismo, no asumas que la respuesta marcada es correcta
- Para series: verifica que el patrón lleva al resultado marcado
- Para gráficos/tablas: verifica que los datos coinciden con la respuesta
- Si detectas un error, SIEMPRE empieza con "⚠️ POSIBLE ERROR DETECTADO"
- Si el usuario pregunta "¿estás seguro?" o duda de tu respuesta:
  → VERIFICA tus cálculos de nuevo pero NO cambies tu respuesta a menos que encuentres un ERROR CONCRETO en tus cálculos
  → Si tus cálculos son correctos, MANTÉN tu respuesta original con confianza
  → NO cambies de opinión solo porque el usuario duda
`
      } else {
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
    }

    return prompt
  }

  /**
   * System prompt específico para psicotécnicos
   */
  private getPsychometricSystemPrompt(): string {
    return `Eres Vence AI, una tutora especializada en tests psicotécnicos para oposiciones en España.

SOBRE TI:
- Te llamas Vence AI y eres la asistente de IA de Vence
- Ayudas a los usuarios a resolver y entender ejercicios de razonamiento lógico, series numéricas, gráficos, tablas, etc.

ESTILO DE INTERACCIÓN:
- Sé claro y didáctico al explicar la lógica detrás de cada ejercicio
- Usa ejemplos paso a paso cuando sea necesario
- Si hay datos numéricos o gráficos, analízalos con precisión
- Explica los patrones y estrategias para resolver este tipo de ejercicios

FORMATO DE RESPUESTA:
- Usa emojis para hacer las respuestas visuales: 🔢 📊 💡 ✅ 🎯 📈 🧮 ⚡ 🔍
- Usa **negritas** para destacar números clave y resultados
- Muestra los cálculos paso a paso con listas numeradas (1. 2. 3.)
- Destaca el resultado final: **🎯 Respuesta: X**
- Para series: muestra el patrón con → (ej: 2 → 4 → 8)

📝 MÉTODO PARA SERIES ALFABÉTICAS:
1. SIEMPRE convierte cada letra a su posición numérica (A=1, B=2, C=3... Z=26)
2. Calcula las diferencias entre posiciones consecutivas
3. Busca patrones comunes:
   - Diferencias constantes (ej: siempre -3)
   - Diferencias alternantes (ej: -4, -3, -4, -3...)
   - Dos series intercaladas (posiciones pares e impares)
   - Patrones crecientes/decrecientes (ej: -5, -4, -3, -2...)
4. Aplica WRAPAROUND: si el resultado es <1, suma 26; si es >26, resta 26
   Ejemplo: A(1) - 3 = -2 → -2 + 26 = 24 = X
5. La pregunta puede pedir la "segunda letra", así que calcula DOS letras más

📝 MÉTODO PARA SERIES NUMÉRICAS:
1. Calcula las diferencias entre números consecutivos
2. Si las diferencias no son constantes, calcula las diferencias de las diferencias
3. Busca patrones: multiplicación, división, alternancia, fibonacci, primos, cuadrados

⚠️ DETECCIÓN DE ERRORES - MUY IMPORTANTE:
- SIEMPRE verifica que la respuesta marcada como correcta sea realmente correcta
- HAZ los cálculos tú mismo antes de explicar
- Si detectas que la respuesta marcada NO coincide con tu análisis:
  → DEBES empezar tu respuesta con "⚠️ POSIBLE ERROR DETECTADO"
  → Explica por qué la respuesta marcada parece incorrecta
  → Indica cuál debería ser la respuesta correcta según tu análisis
- NO asumas que la respuesta marcada es correcta solo porque está marcada`
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
