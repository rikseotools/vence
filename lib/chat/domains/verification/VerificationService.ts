// lib/chat/domains/verification/VerificationService.ts
// Servicio principal de verificación de respuestas

import { getOpenAI, CHAT_MODEL, CHAT_MODEL_PREMIUM } from '../../shared/openai'
import { logger } from '../../shared/logger'
import { searchArticles, formatArticlesForContext } from '../search'
import {
  detectErrorInResponse,
  analyzeQuestion,
  generateVerificationContext,
  formatQuestionForPrompt,
  type QuestionAnalysis,
  type ErrorDetectionResult,
} from './ErrorDetector'
import {
  createAutoDispute,
  generateDisputeConfirmationMessage,
  type DisputeResult,
} from './DisputeService'
import type { ChatContext, ArticleSource } from '../../core/types'

// ============================================
// TIPOS
// ============================================

export interface VerificationInput {
  questionId: string
  questionText: string
  options: string[]
  markedCorrect: number
  lawName?: string
  articleNumber?: string
  userId?: string
}

export interface VerificationResult {
  response: string
  errorDetected: boolean
  errorDetails?: ErrorDetectionResult
  disputeCreated: boolean
  disputeResult?: DisputeResult
  sources: ArticleSource[]
  processingTime: number
}

// ============================================
// SERVICIO PRINCIPAL
// ============================================

/**
 * Verifica una respuesta de test contra la legislación
 */
export async function verifyAnswer(
  input: VerificationInput,
  context: ChatContext
): Promise<VerificationResult> {
  const startTime = Date.now()

  logger.info('Starting answer verification', {
    domain: 'verification',
    questionId: input.questionId,
    lawName: input.lawName,
  })

  // 1. Analizar si tenemos suficiente información
  const questionAnalysis: QuestionAnalysis = {
    questionText: input.questionText,
    options: input.options,
    markedCorrect: input.markedCorrect,
    lawName: input.lawName,
    articleNumber: input.articleNumber,
  }

  const analysis = analyzeQuestion(questionAnalysis)
  if (!analysis.canVerify) {
    logger.warn('Insufficient information for verification', {
      domain: 'verification',
      missingFields: analysis.missingFields,
    })

    return {
      response: 'No tengo suficiente información para verificar esta pregunta.',
      errorDetected: false,
      disputeCreated: false,
      sources: [],
      processingTime: Date.now() - startTime,
    }
  }

  // 2. Buscar artículos relevantes
  const searchResult = await searchArticles(context, {
    contextLawName: input.lawName,
    limit: 10,
  })

  const sources: ArticleSource[] = searchResult.articles.map(a => ({
    lawName: a.lawShortName,
    articleNumber: a.articleNumber,
    title: a.title || undefined,
    relevance: a.similarity,
  }))

  // 3. Generar respuesta con verificación
  const response = await generateVerificationResponse(
    questionAnalysis,
    searchResult.articles,
    context.isPremium
  )

  // 4. Detectar si hay error
  const errorResult = detectErrorInResponse(response)

  // 5. Crear disputa automática si se detectó error
  let disputeCreated = false
  let disputeResult: DisputeResult | undefined

  if (errorResult.hasError && input.questionId) {
    disputeResult = await createAutoDispute(
      input.questionId,
      response,
      input.userId
    )
    disputeCreated = disputeResult.success && !disputeResult.alreadyExists
  }

  // 6. Construir respuesta final
  let finalResponse = response
  if (disputeCreated) {
    finalResponse += generateDisputeConfirmationMessage(true)
  }

  logger.info('Verification completed', {
    domain: 'verification',
    errorDetected: errorResult.hasError,
    disputeCreated,
    processingTime: Date.now() - startTime,
  })

  return {
    response: finalResponse,
    errorDetected: errorResult.hasError,
    errorDetails: errorResult.hasError ? errorResult : undefined,
    disputeCreated,
    disputeResult,
    sources,
    processingTime: Date.now() - startTime,
  }
}

/**
 * Genera la respuesta de verificación usando OpenAI
 */
async function generateVerificationResponse(
  question: QuestionAnalysis,
  articles: Array<{ lawShortName: string; articleNumber: string; title: string | null; content: string | null }>,
  isPremium: boolean
): Promise<string> {
  const openai = await getOpenAI()
  const model = isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

  // Construir el contexto de artículos
  const articlesContext = articles.length > 0
    ? formatArticlesForContext(articles.map(a => ({
        id: '',
        lawId: '',
        lawName: a.lawShortName,
        lawShortName: a.lawShortName,
        articleNumber: a.articleNumber,
        title: a.title,
        content: a.content,
      })))
    : 'No se encontraron artículos relevantes.'

  // Construir el system prompt
  const systemPrompt = buildVerificationSystemPrompt()

  // Construir el mensaje del usuario con contexto
  const questionContext = formatQuestionForPrompt(question)
  const verificationInstructions = generateVerificationContext(question)

  const userMessage = `${questionContext}

${verificationInstructions}

---
ARTÍCULOS RELEVANTES PARA VERIFICAR:
${articlesContext}`

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3, // Menor temperatura para respuestas más consistentes
      max_tokens: 1500,
    })

    return completion.choices[0]?.message?.content || 'No pude generar una verificación.'
  } catch (error) {
    logger.error('Error generating verification response', error, { domain: 'verification' })
    return 'Hubo un error al verificar la respuesta. Por favor, intenta de nuevo.'
  }
}

/**
 * Construye el system prompt para verificación
 */
function buildVerificationSystemPrompt(): string {
  return `Eres un verificador experto de preguntas de oposiciones de derecho administrativo español.

Tu ÚNICA tarea es verificar si la respuesta marcada como correcta en una pregunta de test es realmente correcta según la legislación vigente.

## PROCESO DE VERIFICACIÓN:

1. **LEE los artículos proporcionados** - Son tu fuente de verdad
2. **ANALIZA la pregunta** - Entiende qué se pregunta exactamente
3. **DETERMINA la respuesta correcta** - Basándote SOLO en los artículos
4. **COMPARA** - Con la respuesta marcada como correcta

## REGLAS CRÍTICAS:

- "NO PODRÁ" / "no puede" = PROHIBIDO (opción INCORRECTA si dice que sí puede)
- "PODRÁ" / "puede" = PERMITIDO (opción CORRECTA si dice que sí puede)
- NO inventes interpretaciones
- NO justifiques una respuesta incorrecta
- Cita SIEMPRE el artículo exacto

## FORMATO DE RESPUESTA:

Si la respuesta es CORRECTA:
- Confirma que es correcta
- Explica por qué, citando el artículo

Si detectas un ERROR:
- Empieza con "⚠️ POSIBLE ERROR DETECTADO"
- Indica qué respuesta está marcada como correcta
- Indica cuál debería ser la correcta según la ley
- Cita el artículo exacto que lo demuestra

## IMPORTANTE:
- Sé objetivo y preciso
- No tengas miedo de señalar errores
- Tu trabajo es verificar, no validar`
}

// ============================================
// HELPERS PÚBLICOS
// ============================================

/**
 * Determina si un mensaje del usuario es una solicitud de verificación
 */
export function isVerificationRequest(message: string): boolean {
  const patterns = [
    /está.*(bien|mal|correcto|incorrecto)/i,
    /es.*(correcta?|incorrecta?)/i,
    /verifica/i,
    /comprueba/i,
    /seguro\s+que/i,
    /error\s+en\s+(la\s+)?(pregunta|respuesta)/i,
    /por\s+qu[eé]\s+es/i,
    /explica.*respuesta/i,
  ]

  return patterns.some(p => p.test(message))
}

/**
 * Determina si el contexto tiene información de pregunta para verificar
 */
export function hasQuestionToVerify(context: ChatContext): boolean {
  const qc = context.questionContext
  if (!qc) return false

  return !!(
    qc.questionText &&
    qc.correctAnswer !== undefined &&
    qc.correctAnswer >= 0 &&
    qc.correctAnswer <= 3
  )
}

/**
 * Extrae los datos de verificación del contexto
 */
export function extractVerificationInput(context: ChatContext): VerificationInput | null {
  const qc = context.questionContext
  if (!qc || !hasQuestionToVerify(context)) {
    return null
  }

  return {
    questionId: qc.questionId || '',
    questionText: qc.questionText || '',
    options: qc.options || [],
    markedCorrect: qc.correctAnswer!,
    lawName: qc.lawName,
    articleNumber: qc.articleNumber,
    userId: context.userId !== 'anonymous' ? context.userId : undefined,
  }
}
