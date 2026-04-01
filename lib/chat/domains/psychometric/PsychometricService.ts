// lib/chat/domains/psychometric/PsychometricService.ts
// Servicio que orquesta la lógica de psicotécnicos: validación + prompt + LLM

import type { ChatContext, ChatResponse, AITracerInterface } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
import { getAnthropic, ANTHROPIC_MODEL } from '../../shared/anthropic'
import { selectModel } from '../../shared/modelRouter'
import { logger } from '../../shared/logger'
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

  // 4. Llamar al LLM - routing por subtype
  const modelSelection = selectModel({
    domain: 'psychometric',
    questionSubtype: subtype,
    isPsicotecnico: true,
  })

  // Temperature baja para psicotécnicos: precisión > creatividad
  const temperature = 0.3
  let content: string
  let totalTokens: number | undefined
  let promptTokens: number | undefined
  let completionTokens: number | undefined
  let finishReason: string | undefined
  let model: string

  if (modelSelection.provider === 'anthropic') {
    // Claude Sonnet para subtypes que requieren razonamiento avanzado
    const anthropic = await getAnthropic()
    model = ANTHROPIC_MODEL

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

    const response = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      temperature,
      system: systemPrompt,
      messages: anthropicMessages,
    })

    content = response.content[0]?.type === 'text' ? response.content[0].text : 'No pude generar una respuesta.'
    promptTokens = response.usage.input_tokens
    completionTokens = response.usage.output_tokens
    totalTokens = promptTokens + completionTokens
    finishReason = response.stop_reason || undefined

    llmSpan?.setOutput({ responseContent: content, finishReason, promptTokens, completionTokens, totalTokens })
    llmSpan?.addMetadata('tokensIn', promptTokens)
    llmSpan?.addMetadata('tokensOut', completionTokens)
    llmSpan?.addMetadata('model', model)
    llmSpan?.addMetadata('provider', 'anthropic')
    llmSpan?.addMetadata('responseLength', content.length)
    llmSpan?.end()

    logger.info(`Psychometric using Claude: ${subtype}`, { domain: 'psychometric', model, reason: modelSelection.reason })
  } else {
    // OpenAI GPT-4o para subtypes estándar
    const openai = await getOpenAI()
    model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

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

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: 1500,
    })

    content = completion.choices[0]?.message?.content || 'No pude generar una respuesta.'
    promptTokens = completion.usage?.prompt_tokens
    completionTokens = completion.usage?.completion_tokens
    totalTokens = completion.usage?.total_tokens
    finishReason = completion.choices[0]?.finish_reason || undefined

    llmSpan?.setOutput({ responseContent: content, finishReason, promptTokens, completionTokens, totalTokens })
    llmSpan?.addMetadata('tokensIn', promptTokens)
    llmSpan?.addMetadata('tokensOut', completionTokens)
    llmSpan?.addMetadata('model', model)
    llmSpan?.addMetadata('provider', 'openai')
    llmSpan?.addMetadata('responseLength', content.length)
    llmSpan?.end()
  }

  // 5. Construir respuesta
  const builder = new ChatResponseBuilder()
    .domain('psychometric')
    .text(content)
    .processingTime(Date.now() - startTime)

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
