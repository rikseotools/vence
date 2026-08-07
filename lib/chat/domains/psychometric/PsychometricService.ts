// lib/chat/domains/psychometric/PsychometricService.ts
// Servicio que orquesta la lógica de psicotécnicos: validación + prompt + LLM

import type { ChatContext, ChatResponse, AITracerInterface } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
import { getAnthropic, getAnthropicModel } from '../../shared/anthropic'
import { selectModel, type ModelProvider } from '../../shared/modelRouter'
import { clasificarErrorProveedor, mensajeDeError } from '@/lib/chat/shared/errorResponses'
import { runWithLlmFeature } from '@/lib/observability/llm'
import { logger } from '../../shared/logger'
import { stripLatex } from '../../shared/formatting'
import { isPsychometricSubtype } from '../../shared/constants'
import { buildPsychometricPrompt, normalizeOptions, getCorrectLetter } from './prompts'
import { validateLetterSequence, validateNumericSequence } from './validators/sequenceValidator'
import type { SequenceValidationResult } from './validators/sequenceValidator'

/**
 * Determina el grupo funcional del subtipo psicotécnico.
 * Esto decide qué validadores y prompts especializados usar.
 */
export function getSubtypeGroup(subtype: string | null | undefined): 'series' | 'charts' | 'text' | 'unknown' {
  if (!subtype) return 'unknown'
  if (subtype.startsWith('sequence_')) return 'series'
  if (subtype.endsWith('_chart') || subtype === 'data_tables') return 'charts'
  if (subtype === 'error_detection' || subtype === 'word_analysis') return 'text'
  return 'unknown'
}

/**
 * Ejecuta la validación matemática determinista para series.
 * Solo aplica a sequence_letter, sequence_numeric, sequence_alphanumeric.
 * Retorna null si no es aplicable o no se pudo validar.
 */
function runSequenceValidation(context: ChatContext): SequenceValidationResult | undefined {
  const qc = context.questionContext
  if (!qc) return undefined

  const subtype = qc.questionSubtype || ''
  const group = getSubtypeGroup(subtype)

  if (group !== 'series') return undefined

  const options = normalizeOptions(qc)
  const correctAnswer = qc.correctAnswer
  if (correctAnswer === undefined || correctAnswer === null) return undefined

  const correctOption = typeof correctAnswer === 'number'
    ? correctAnswer
    : correctAnswer.toUpperCase().charCodeAt(0) - 65

  const questionText = qc.questionText || ''
  const contentData = qc.contentData as Record<string, unknown> | undefined

  if (subtype === 'sequence_letter' || subtype === 'sequence_alphanumeric') {
    const result = validateLetterSequence(questionText, options, correctOption, contentData)
    if (result.validated) return result
  }

  if (subtype === 'sequence_numeric') {
    const result = validateNumericSequence(questionText, options, correctOption, contentData)
    if (result.validated) return result
  }

  return undefined
}

/**
 * Procesa una pregunta psicotécnica: valida matemáticamente si es serie,
 * construye el prompt especializado y llama al LLM.
 */
export async function processPsychometricQuestion(
  context: ChatContext,
  tracer?: AITracerInterface
): Promise<ChatResponse> {
  const startTime = Date.now()
  // Subtype del contexto, o inferir del mensaje si no hay contexto
  let subtype = context.questionContext?.questionSubtype || ''
  if (!subtype) {
    const msg = context.currentMessage.toLowerCase()
    if (/serie\s+alfanum/i.test(msg)) subtype = 'sequence_alphanumeric'
    else if (/serie\s+(de\s+)?letras|serie\s+alfab/i.test(msg)) subtype = 'sequence_letter'
    else if (/serie\s+num[eé]rica/i.test(msg)) subtype = 'sequence_numeric'
    else if (/tabla\s+de\s+datos/i.test(msg)) subtype = 'data_tables'
    else if (/c[aá]lculo|regla\s+de\s+tres/i.test(msg)) subtype = 'calculation'
  }
  const group = getSubtypeGroup(subtype)

  logger.info('PsychometricService processing', {
    domain: 'psychometric',
    subtype,
    group,
    questionId: context.questionContext?.questionId ?? undefined,
  })

  // 0. Detectar contenido visual faltante en subtypes de gráficos/tablas
  const isVisualSubtype = group === 'charts'
  const cd = context.questionContext?.contentData
  const hasContentData = cd && typeof cd === 'object' && Object.keys(cd as Record<string, unknown>).length > 0
  const hasImageUrl = !!(context.questionContext as Record<string, unknown>)?.imageUrl
  const hasVisualData = hasContentData || hasImageUrl
  const questionId = context.questionContext?.questionId

  if (isVisualSubtype && !hasVisualData && questionId) {
    logger.warn('PsychometricService: Visual subtype without content_data/image_url, reporting', {
      domain: 'psychometric',
      subtype,
      questionId,
    })

    // Reportar automáticamente como feedback bug (fire-and-forget, deduplicado por questionId)
    reportMissingVisualContent(questionId, subtype, context.userId).catch(err => {
      logger.warn('PsychometricService: Error reporting missing visual', { domain: 'psychometric', error: String(err) })
    })
  }

  // 1. Validación matemática (solo para series)
  const validationSpan = tracer?.spanDB('sequenceValidation', {
    subtype,
    group,
    questionText: context.questionContext?.questionText,
  })

  const validation = runSequenceValidation(context)

  validationSpan?.setOutput({
    validated: validation?.validated ?? false,
    confirmsDbAnswer: validation?.confirmsDbAnswer ?? null,
    computedValue: validation?.computedValue ?? null,
    pattern: validation?.pattern ?? null,
    steps: validation?.steps ?? [],
  })
  validationSpan?.end()

  if (validation?.validated) {
    logger.info('Sequence validation result', {
      domain: 'psychometric',
      confirms: validation.confirmsDbAnswer,
      computed: validation.computedValue,
      pattern: validation.pattern,
    })
  }

  // 2. Construir prompt especializado
  const systemPrompt = buildPsychometricPrompt(
    { questionContext: context.questionContext! },
    validation
  )

  // 3. Construir mensajes para OpenAI
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  for (const msg of context.messages) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  // 4. Llamar al LLM - routing por subtype + categoría
  // (text_question requiere mirar categoría para distinguir matemáticas de verbal/ortografía)
  const modelSelection = selectModel({
    domain: 'psychometric',
    questionSubtype: subtype,
    questionCategory: context.questionContext?.questionCategory ?? null,
    isPsicotecnico: true,
  })

  // Temperature baja para psicotécnicos: precisión > creatividad
  const temperature = 0.3

  interface ProviderCallResult {
    content: string
    totalTokens: number | undefined
    model: string
  }

  async function callAnthropic(): Promise<ProviderCallResult> {
    const anthropic = await getAnthropic()
    const model = await getAnthropicModel()

    const llmSpan = tracer?.spanLLM({
      model,
      temperature,
      maxTokens: 2000,
      systemPrompt,
      userPrompt: context.currentMessage,
      messagesArray: messages,
      psychometricSubtype: subtype,
      psychometricGroup: group,
      validationResult: validation ? {
        validated: validation.validated,
        confirmsDbAnswer: validation.confirmsDbAnswer,
        computedValue: validation.computedValue,
      } : null,
    })

    // Convertir mensajes OpenAI format → Anthropic format
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    let response
    try {
      response = await anthropic.messages.create({
        model,
        max_tokens: 2000,
        temperature,
        system: systemPrompt,
        messages: anthropicMessages,
      })
    } catch (err: any) {
      const status = err?.status || err?.response?.status
      llmSpan?.setOutput({ responseContent: null, finishReason: 'error', errorStatus: status, errorMessage: err?.message })
      llmSpan?.addMetadata('model', model)
      llmSpan?.addMetadata('provider', 'anthropic')
      llmSpan?.addMetadata('anthropicError', String(status || 'unknown'))
      llmSpan?.end()
      logger.warn(`Psychometric Anthropic call failed: ${status}`, { domain: 'psychometric', model, error: err?.message })
      throw err
    }

    const content = response.content[0]?.type === 'text' ? response.content[0].text : 'No pude generar una respuesta.'
    const promptTokens = response.usage.input_tokens
    const completionTokens = response.usage.output_tokens
    const totalTokens = promptTokens + completionTokens
    const finishReason = response.stop_reason || undefined

    llmSpan?.setOutput({ responseContent: content, finishReason, promptTokens, completionTokens, totalTokens })
    llmSpan?.addMetadata('tokensIn', promptTokens)
    llmSpan?.addMetadata('tokensOut', completionTokens)
    llmSpan?.addMetadata('model', model)
    llmSpan?.addMetadata('provider', 'anthropic')
    llmSpan?.addMetadata('responseLength', content.length)
    llmSpan?.end()

    logger.info(`Psychometric using Claude: ${subtype}`, { domain: 'psychometric', model, reason: modelSelection.reason })
    return { content, totalTokens, model }
  }

  async function callOpenAI(): Promise<ProviderCallResult> {
    const openai = await getOpenAI()
    const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

    const llmSpan = tracer?.spanLLM({
      model,
      temperature,
      maxTokens: 1500,
      systemPrompt,
      userPrompt: context.currentMessage,
      messagesArray: messages,
      psychometricSubtype: subtype,
      psychometricGroup: group,
      validationResult: validation ? {
        validated: validation.validated,
        confirmsDbAnswer: validation.confirmsDbAnswer,
        computedValue: validation.computedValue,
      } : null,
    })

    let completion
    try {
      completion = await openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: 1500,
      })
    } catch (err: any) {
      const status = err?.status || err?.response?.status
      llmSpan?.setOutput({ responseContent: null, finishReason: 'error', errorStatus: status, errorMessage: err?.message })
      llmSpan?.addMetadata('model', model)
      llmSpan?.addMetadata('provider', 'openai')
      llmSpan?.end()
      logger.warn(`Psychometric OpenAI call failed: ${status}`, { domain: 'psychometric', model, error: err?.message })
      throw err
    }

    const content = completion.choices[0]?.message?.content || 'No pude generar una respuesta.'
    const promptTokens = completion.usage?.prompt_tokens
    const completionTokens = completion.usage?.completion_tokens
    const totalTokens = completion.usage?.total_tokens
    const finishReason = completion.choices[0]?.finish_reason || undefined

    llmSpan?.setOutput({ responseContent: content, finishReason, promptTokens, completionTokens, totalTokens })
    llmSpan?.addMetadata('tokensIn', promptTokens)
    llmSpan?.addMetadata('tokensOut', completionTokens)
    llmSpan?.addMetadata('model', model)
    llmSpan?.addMetadata('provider', 'openai')
    llmSpan?.addMetadata('responseLength', content.length)
    llmSpan?.end()

    return { content, totalTokens, model }
  }

  // Cadena de respaldo [T-163]: si el proveedor elegido por routing falla con una
  // EXCEPCIÓN del SDK (5xx, sin saldo, timeout, red — nunca un error de contenido: eso
  // da una respuesta VÁLIDA con texto raro, no una excepción), se intenta el OTRO
  // proveedor antes de rendirse. Medido en el incidente del 26/07 (saldo de Anthropic
  // agotado 09:38-17:08 UTC): 21 chats enrutados a Anthropic fallaron sin respuesta
  // mientras OpenAI seguía disponible — exactamente los psicotécnicos de cálculo, que es
  // donde el chat más aporta. No busca igualar calidad (Anthropic se elige a propósito
  // por razonamiento): una respuesta peor es mejor que ninguna, pero queda marcada.
  const providerChain: ModelProvider[] =
    modelSelection.provider === 'anthropic' ? ['anthropic', 'openai'] : ['openai', 'anthropic']

  let result: ProviderCallResult | undefined
  let actualProvider: ModelProvider = modelSelection.provider
  let usedFallback = false
  let primaryError: unknown

  for (let i = 0; i < providerChain.length; i++) {
    const provider = providerChain[i]
    const call = provider === 'anthropic' ? callAnthropic : callOpenAI
    try {
      // La feature del intento de respaldo se etiqueta aparte en observable_events
      // (`llm_call.endpoint`) para poder contar "cuántas veces se cayó el primario" sin
      // tener que correlacionar dos eventos por fecha/sesión.
      result = i === 0 ? await call() : await runWithLlmFeature('psychometric_fallback', call)
      actualProvider = provider
      usedFallback = i > 0
      break
    } catch (err) {
      if (i === 0) {
        primaryError = err
        continue
      }
      // Los dos proveedores fallaron: no queda a quién recurrir.
      const status = (err as any)?.status || (err as any)?.response?.status
      const motivo = clasificarErrorProveedor(status, (err as any)?.message)
      const userMsg = mensajeDeError(motivo)
      logger.warn('Psychometric: los DOS proveedores fallaron, sin respaldo posible', {
        domain: 'psychometric',
        primaryProvider: modelSelection.provider,
        primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
        fallbackError: err instanceof Error ? err.message : String(err),
      })
      return new ChatResponseBuilder()
        .domain('psychometric')
        .text(userMsg)
        .processingTime(Date.now() - startTime)
        .build()
    }
  }

  // Inalcanzable: el bucle de arriba o deja `result` puesto (break) o hace `return` en el
  // fallo del último proveedor de la cadena. TypeScript no puede verlo sin esta guarda, y
  // un `!` aquí escondería un fallo real si la lógica del bucle cambiara.
  if (!result) {
    return new ChatResponseBuilder()
      .domain('psychometric')
      .text(mensajeDeError('generico'))
      .processingTime(Date.now() - startTime)
      .build()
  }

  if (usedFallback) {
    logger.warn(`Psychometric: respondido por el proveedor de RESPALDO (${actualProvider}) tras fallo de ${modelSelection.provider}`, {
      domain: 'psychometric',
      primaryProvider: modelSelection.provider,
      fallbackProvider: actualProvider,
      primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError),
    })
  }

  let content = result.content
  const totalTokens = result.totalTokens
  const model = result.model

  // 5. Post-procesar: limpiar LaTeX que la UI no renderiza (defensa adicional
  // al system prompt — el LLM lo usa a veces aunque se le pida no usarlo).
  content = stripLatex(content) || content

  // 6. Construir respuesta
  const builder = new ChatResponseBuilder()
    .domain('psychometric')
    .text(content)
    .processingTime(Date.now() - startTime)
    .model(actualProvider, model)

  if (totalTokens) {
    builder.tokensUsed(totalTokens)
  }

  return builder.build()
}

// ============================================
// REPORTE AUTOMÁTICO DE CONTENIDO VISUAL FALTANTE
// ============================================

// Cache en memoria para no reportar la misma pregunta más de una vez por proceso
const reportedQuestions = new Set<string>()

/**
 * Crea un feedback automático cuando una pregunta psicotécnica visual
 * no tiene content_data ni image_url. Deduplicado por questionId.
 */
async function reportMissingVisualContent(
  questionId: string,
  subtype: string,
  userId?: string | null,
): Promise<void> {
  // Deduplicar en memoria (mismo proceso serverless)
  if (reportedQuestions.has(questionId)) return
  reportedQuestions.add(questionId)

  try {
    const { getDb } = await import('@/db/client')
    const { userFeedback } = await import('@/db/schema')
    const { eq, and } = await import('drizzle-orm')

    const db = getDb()

    // Deduplicar en BD: no crear si ya existe un feedback para esta pregunta
    const [existing] = await db
      .select({ id: userFeedback.id })
      .from(userFeedback)
      .where(and(
        eq(userFeedback.questionId, questionId),
        eq(userFeedback.type, 'bug'),
      ))
      .limit(1)

    if (existing) return

    // Crear feedback
    await db.insert(userFeedback).values({
      userId: userId || null,
      type: 'bug',
      message: `[Auto] Pregunta psicotécnica (${subtype}) sin contenido visual. No tiene content_data ni image_url. El usuario no puede ver la tabla/gráfico necesario para resolver la pregunta.`,
      url: '/psicotecnicos/test',
      status: 'pending',
      priority: 'medium',
      questionId,
    })

    logger.info('PsychometricService: Reported missing visual content', {
      domain: 'psychometric',
      questionId,
      subtype,
    })
  } catch (err) {
    logger.warn('PsychometricService: Failed to report missing visual', {
      domain: 'psychometric',
      error: String(err),
    })
  }
}
