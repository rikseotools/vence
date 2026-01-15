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
import { getLinkedArticle, type LinkedArticle } from './queries'
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
  // Datos adicionales de nuestra BD
  explanation?: string
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

  // 2. Obtener artículo vinculado directamente (si existe)
  const linkedArticle = input.questionId
    ? await getLinkedArticle(input.questionId)
    : null

  if (linkedArticle) {
    logger.info(`🔎 Found linked article: ${linkedArticle.lawShortName} Art. ${linkedArticle.articleNumber}`, {
      domain: 'verification',
    })
  }

  // 3. Buscar artículos relevantes por embedding
  // Usar el texto de la pregunta del test como query de búsqueda
  const searchQuery = input.articleNumber
    ? `Artículo ${input.articleNumber} ${input.lawName || ''} ${input.questionText}`
    : input.questionText

  const searchResult = await searchArticles(context, {
    contextLawName: input.lawName,
    searchQuery,
    limit: 8, // Reducido porque tenemos el artículo vinculado
  })

  // Combinar artículo vinculado con artículos por embedding
  let allArticles = searchResult.articles
  if (linkedArticle) {
    // Añadir artículo vinculado al principio si no está ya
    const alreadyIncluded = allArticles.some(
      a => a.articleNumber === linkedArticle.articleNumber && a.lawShortName === linkedArticle.lawShortName
    )
    if (!alreadyIncluded) {
      allArticles = [{
        id: linkedArticle.id,
        lawId: '',
        lawName: linkedArticle.lawName,
        lawShortName: linkedArticle.lawShortName,
        articleNumber: linkedArticle.articleNumber,
        title: linkedArticle.title,
        content: linkedArticle.content,
        similarity: 1.0, // Máxima relevancia por estar vinculado
      }, ...allArticles]
    }
  }

  const sources: ArticleSource[] = allArticles.map(a => ({
    lawName: a.lawShortName,
    articleNumber: a.articleNumber,
    title: a.title || undefined,
    relevance: a.similarity,
  }))

  // 4. Generar respuesta con verificación (pasando TODO el contexto)
  const response = await generateVerificationResponse(
    questionAnalysis,
    allArticles,
    context.isPremium,
    input.explanation,
    linkedArticle
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
  isPremium: boolean,
  ourExplanation?: string,
  linkedArticle?: LinkedArticle | null
): Promise<string> {
  const openai = await getOpenAI()
  const model = isPremium ? CHAT_MODEL_PREMIUM : CHAT_MODEL

  // Construir el contexto de artículos por embedding
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
    : 'No se encontraron artículos relevantes en la base de datos.'

  // Construir sección del artículo vinculado (si existe)
  let linkedArticleSection = ''
  if (linkedArticle) {
    linkedArticleSection = `
---
📌 ARTÍCULO VINCULADO A ESTA PREGUNTA (fuente principal):
[${linkedArticle.lawShortName}] Artículo ${linkedArticle.articleNumber}
${linkedArticle.title ? `Título: ${linkedArticle.title}` : ''}
${linkedArticle.content || 'Sin contenido disponible'}
`
  }

  // Construir sección de nuestra explicación (si existe)
  let ourExplanationSection = ''
  if (ourExplanation) {
    ourExplanationSection = `
---
📝 EXPLICACIÓN DE NUESTRA BASE DE DATOS:
${ourExplanation}
`
  }

  // Construir el system prompt
  const systemPrompt = buildVerificationSystemPrompt()

  // Construir el mensaje del usuario con contexto
  const questionContext = formatQuestionForPrompt(question)
  const verificationInstructions = generateVerificationContext(question)

  const userMessage = `${questionContext}
${linkedArticleSection}
${ourExplanationSection}
${verificationInstructions}

---
ARTÍCULOS ADICIONALES ENCONTRADOS POR SIMILITUD:
${articlesContext}

---
INSTRUCCIONES DE ANÁLISIS:
1. Si hay ARTÍCULO VINCULADO, ese es la fuente principal de verdad
2. Compara nuestra explicación con lo que dice el artículo real
3. Si hay inconsistencias entre la explicación y el artículo, señálalas
4. Si la pregunta menciona una ley específica (ej: "Real Decreto 366/2007") pero no tenemos ese artículo, usa tu conocimiento general pero aclara que no pudiste verificar con la fuente primaria`

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
  return `Eres un tutor experto de oposiciones de derecho administrativo español. Tu rol es explicar las respuestas de forma clara, didáctica y amigable.

## 🎯 TU OBJETIVO
Explicar por qué la respuesta correcta es correcta, de forma que el opositor aprenda y entienda el concepto.

## 📝 FORMATO DE RESPUESTA (MUY IMPORTANTE)
Usa formato rico para que sea fácil de leer:
- **Negritas** para conceptos clave y artículos
- Emojis relevantes (✅ ❌ 📌 💡 ⚖️ 📖 🎯) para hacer la lectura más amena
- Párrafos cortos y claros
- Listas cuando sea apropiado

## 📋 ESTRUCTURA DE TU RESPUESTA

1. **Respuesta correcta** - Confirma cuál es y por qué
2. **Fundamento legal** - Cita el artículo exacto con su contenido relevante
3. **Explicación didáctica** - Explica el concepto de forma sencilla
4. **Por qué las otras opciones son incorrectas** (brevemente, opcional)

## ⚠️ SI DETECTAS UN ERROR
Si la respuesta marcada como correcta NO coincide con la legislación:
- Empieza con "⚠️ **Posible error detectado**"
- Explica qué dice la ley realmente
- Sé claro pero respetuoso

## 🎨 EJEMPLO DE FORMATO
✅ **La respuesta correcta es la B**

📖 Según el **artículo 54 de la Constitución Española**:
> "El Defensor del Pueblo es el alto comisionado de las Cortes Generales..."

💡 **Explicación**: El Defensor del Pueblo actúa como garante de los derechos fundamentales...

❌ Las otras opciones son incorrectas porque...

## REGLAS
- Sé conciso pero completo
- Usa lenguaje cercano y motivador
- NO incluyas sección de "Fuentes" al final (ya se muestran aparte)
- Si no tienes el artículo exacto, usa tu conocimiento pero acláralo`
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
 * Normaliza una respuesta a número (0-3)
 * Acepta: número 0-3, string 'A'-'D', string '0'-'3'
 */
function normalizeAnswer(answer: number | string | null | undefined): number | null {
  if (answer === null || answer === undefined) return null

  // Si ya es número válido
  if (typeof answer === 'number' && answer >= 0 && answer <= 3) {
    return answer
  }

  // Si es string letra (A-D)
  if (typeof answer === 'string') {
    const letterMap: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }
    const upper = answer.toUpperCase()
    if (letterMap[upper] !== undefined) {
      return letterMap[upper]
    }

    // Si es string numérico
    const num = parseInt(answer, 10)
    if (!isNaN(num) && num >= 0 && num <= 3) {
      return num
    }
  }

  return null
}

/**
 * Determina si el contexto tiene información de pregunta para verificar
 */
export function hasQuestionToVerify(context: ChatContext): boolean {
  const qc = context.questionContext
  if (!qc) return false

  const normalizedAnswer = normalizeAnswer(qc.correctAnswer)

  return !!(
    qc.questionText &&
    normalizedAnswer !== null
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

  const normalizedCorrect = normalizeAnswer(qc.correctAnswer)
  if (normalizedCorrect === null) {
    return null
  }

  // Normalizar options a array de strings
  let optionsArray: string[] = []
  if (Array.isArray(qc.options)) {
    optionsArray = qc.options
  } else if (qc.options && typeof qc.options === 'object') {
    // Options puede venir como objeto {a, b, c, d} desde el frontend
    const opts = qc.options as { a?: string; b?: string; c?: string; d?: string }
    optionsArray = [opts.a || '', opts.b || '', opts.c || '', opts.d || '']
  }

  return {
    questionId: qc.questionId || qc.id || '',
    questionText: qc.questionText || '',
    options: optionsArray,
    markedCorrect: normalizedCorrect,
    lawName: qc.lawName ?? undefined,
    articleNumber: qc.articleNumber ?? undefined,
    userId: context.userId !== 'anonymous' ? context.userId : undefined,
    explanation: qc.explanation ?? undefined,
  }
}
