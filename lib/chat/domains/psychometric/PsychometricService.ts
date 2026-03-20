// lib/chat/domains/psychometric/PsychometricService.ts
// Servicio que orquesta la lógica de psicotécnicos: validación + prompt + LLM

import type { ChatContext, ChatResponse, AITracerInterface } from '../../core/types'
import { ChatResponseBuilder } from '../../core/ChatResponseBuilder'
import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
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
  const subtype = context.questionContext?.questionSubtype || ''
  const group = getSubtypeGroup(subtype)

  logger.info('PsychometricService processing', {
    domain: 'psychometric',
    subtype,
    group,
    questionId: context.questionContext?.questionId ?? undefined,
  })

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

  // 4. Llamar al LLM
  const openai = await getOpenAI()
  const model = context.isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

  // Temperature baja para psicotécnicos: precisión > creatividad
  const temperature = 0.3

  const llmSpan = tracer?.spanLLM({
    model,
    temperature,
    maxTokens: 1500,
    systemPrompt,
    userPrompt: context.currentMessage,
    messagesArray: messages,
    // Metadata específica de psicotécnicos
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

  const content = completion.choices[0]?.message?.content || 'No pude generar una respuesta.'
  const totalTokens = completion.usage?.total_tokens

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
