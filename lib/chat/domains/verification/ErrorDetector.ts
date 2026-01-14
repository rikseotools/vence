// lib/chat/domains/verification/ErrorDetector.ts
// Servicio para detectar errores en respuestas de test

import { logger } from '../../shared/logger'

// ============================================
// TIPOS
// ============================================

export interface ErrorDetectionResult {
  hasError: boolean
  errorType?: 'contradiction' | 'incorrect_answer' | 'ambiguous'
  confidence: number
  details?: string
}

export interface QuestionAnalysis {
  questionText: string
  options: string[]
  markedCorrect: number
  lawName?: string
  articleNumber?: string
}

// ============================================
// PATRONES DE DETECCIÓN
// ============================================

const ERROR_PATTERNS = [
  /⚠️\s*POSIBLE\s*ERROR/i,
  /ERROR\s*DETECTADO/i,
  /la\s+respuesta\s+correcta\s+(debería|sería|es)\s+(?!.*según\s+la\s+base)/i,
  /contradice\s+(el|la|lo)\s+(artículo|ley|normativa)/i,
  /según\s+(el|la)\s+artículo.*(?:no\s+es|es\s+incorrecta)/i,
]

const CONFIRMATION_PATTERNS = [
  /es\s+correcta?\s+porque/i,
  /la\s+respuesta\s+.*\s+es\s+acertada/i,
  /efectivamente.*es\s+la\s+correcta/i,
  /confirmo\s+que\s+es\s+correcta/i,
]

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

/**
 * Detecta si una respuesta de la IA indica un posible error
 */
export function detectErrorInResponse(response: string): ErrorDetectionResult {
  // Verificar patrones de error
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(response)) {
      logger.debug('Error pattern detected in response', { domain: 'verification' })

      return {
        hasError: true,
        errorType: determineErrorType(response),
        confidence: calculateErrorConfidence(response),
        details: extractErrorDetails(response),
      }
    }
  }

  // Verificar si hay confirmación explícita
  const hasConfirmation = CONFIRMATION_PATTERNS.some(p => p.test(response))
  if (hasConfirmation) {
    return {
      hasError: false,
      confidence: 0.9,
    }
  }

  // No se detectó error ni confirmación clara
  return {
    hasError: false,
    confidence: 0.5,
  }
}

/**
 * Analiza la respuesta y determina el tipo de error
 */
function determineErrorType(response: string): 'contradiction' | 'incorrect_answer' | 'ambiguous' {
  const lower = response.toLowerCase()

  if (lower.includes('contradice') || lower.includes('contradicción')) {
    return 'contradiction'
  }

  if (lower.includes('respuesta correcta') && (lower.includes('debería') || lower.includes('sería'))) {
    return 'incorrect_answer'
  }

  if (lower.includes('ambigua') || lower.includes('ambiguo') || lower.includes('puede interpretarse')) {
    return 'ambiguous'
  }

  return 'incorrect_answer'
}

/**
 * Calcula el nivel de confianza del error detectado
 */
function calculateErrorConfidence(response: string): number {
  let confidence = 0.5

  // Aumentar confianza si hay emoji de warning
  if (response.includes('⚠️')) {
    confidence += 0.2
  }

  // Aumentar si menciona "POSIBLE ERROR" explícitamente
  if (/POSIBLE\s*ERROR/i.test(response)) {
    confidence += 0.2
  }

  // Aumentar si cita un artículo específico
  if (/art[íi]culo\s+\d+/i.test(response)) {
    confidence += 0.1
  }

  // Aumentar si menciona una ley específica
  if (/ley\s+\d+\/\d+/i.test(response)) {
    confidence += 0.1
  }

  return Math.min(confidence, 1)
}

/**
 * Extrae los detalles del error detectado
 */
function extractErrorDetails(response: string): string {
  // Buscar la sección que describe el error (desde ⚠️ hasta doble salto de línea)
  const warningIndex = response.indexOf('⚠️')
  if (warningIndex !== -1) {
    const afterWarning = response.substring(warningIndex)
    const endIndex = afterWarning.indexOf('\n\n')
    const errorSection = endIndex !== -1 ? afterWarning.substring(0, endIndex) : afterWarning
    return errorSection.substring(0, 500)
  }

  // Buscar oraciones que contengan "error" o "incorrecta"
  const sentences = response.split(/[.!?]/)
  const relevantSentences = sentences.filter(s =>
    /error|incorrecta|contradice|debería/i.test(s)
  )

  return relevantSentences.slice(0, 2).join('. ').substring(0, 500)
}

// ============================================
// ANÁLISIS DE PREGUNTA
// ============================================

/**
 * Analiza una pregunta para preparar la verificación
 */
export function analyzeQuestion(question: QuestionAnalysis): {
  hasAllInfo: boolean
  missingFields: string[]
  canVerify: boolean
} {
  const missingFields: string[] = []

  if (!question.questionText) {
    missingFields.push('questionText')
  }

  if (!question.options || question.options.length < 4) {
    missingFields.push('options')
  }

  if (question.markedCorrect === undefined || question.markedCorrect < 0 || question.markedCorrect > 3) {
    missingFields.push('markedCorrect')
  }

  // Para verificar necesitamos al menos la pregunta, opciones y respuesta marcada
  const canVerify = missingFields.length === 0

  // Más confiable si tenemos ley y artículo
  const hasAllInfo = canVerify && !!question.lawName

  return {
    hasAllInfo,
    missingFields,
    canVerify,
  }
}

/**
 * Genera el contexto de verificación para el prompt
 */
export function generateVerificationContext(
  question: QuestionAnalysis
): string {
  const correctLetter = String.fromCharCode(65 + question.markedCorrect)
  const correctText = question.options[question.markedCorrect] || 'No disponible'

  return `
⚠️ INSTRUCCIONES CRÍTICAS - PROCESO DE VERIFICACIÓN EN 2 PASOS:

PASO 1 - DETERMINA LA RESPUESTA CORRECTA TÚ MISMO:
- Lee los artículos del CONTEXTO (más abajo)
- Si dice "NO PODRÁ" o "no puede", esas opciones están PROHIBIDAS
- Si dice "PODRÁ" o "puede", esas opciones están PERMITIDAS
- Determina cuál es la respuesta correcta según la LEY, NO según lo que te digan

PASO 2 - COMPARA CON LA RESPUESTA MARCADA:
- Esta pregunta da por buena: ${correctLetter}) ${correctText}
- Si TU respuesta (del paso 1) es DIFERENTE a ${correctLetter}:
  → Di: "⚠️ POSIBLE ERROR: Esta pregunta da por buena la opción ${correctLetter}, pero según [cita el artículo exacto], la respuesta correcta es [tu respuesta]"
- Si TU respuesta coincide con ${correctLetter}:
  → Confirma que es correcta y explica por qué

REGLAS ABSOLUTAS:
- Lee LITERALMENTE: "no podrá" = PROHIBIDO, "podrá" = PERMITIDO
- NO inventes interpretaciones
- NO justifiques una respuesta que contradice el texto literal de la ley
- Si la ley dice "NO PODRÁ hacer X" y la pregunta dice que SÍ puede hacer X, ES UN ERROR
`
}

/**
 * Formatea la pregunta para incluir en el prompt
 */
export function formatQuestionForPrompt(question: QuestionAnalysis): string {
  const letters = ['A', 'B', 'C', 'D']
  const optionsText = question.options
    .map((opt, i) => `${letters[i]}) ${opt}`)
    .join('\n')

  let text = `
El usuario está viendo esta pregunta en un test:

Pregunta: ${question.questionText}

Opciones:
${optionsText}
`

  if (question.lawName) {
    text += `\nLey relacionada: ${question.lawName}`
  }

  if (question.articleNumber) {
    text += `\nArtículo relacionado: ${question.articleNumber}`
  }

  return text
}

// ============================================
// COMPARACIÓN DE RESPUESTAS
// ============================================

/**
 * Compara dos respuestas y determina si hay discrepancia
 */
export function compareAnswers(
  markedCorrect: number,
  aiSuggestedCorrect: number | null
): {
  match: boolean
  discrepancy?: string
} {
  if (aiSuggestedCorrect === null) {
    return { match: true } // No se pudo determinar, asumir correcto
  }

  if (markedCorrect === aiSuggestedCorrect) {
    return { match: true }
  }

  const markedLetter = String.fromCharCode(65 + markedCorrect)
  const suggestedLetter = String.fromCharCode(65 + aiSuggestedCorrect)

  return {
    match: false,
    discrepancy: `Marcada: ${markedLetter}, Sugerida: ${suggestedLetter}`,
  }
}

/**
 * Extrae la respuesta sugerida por la IA de su respuesta
 */
export function extractSuggestedAnswer(response: string): number | null {
  // Buscar patrones como "la respuesta correcta es A" o "debería ser B"
  const patterns = [
    /la\s+respuesta\s+correcta\s+(?:es|sería|debería\s+ser)\s+([A-D])/i,
    /correcta?\s+es\s+(?:la\s+)?opción\s+([A-D])/i,
    /opción\s+([A-D])\s+es\s+(?:la\s+)?correcta/i,
  ]

  for (const pattern of patterns) {
    const match = response.match(pattern)
    if (match) {
      const letter = match[1].toUpperCase()
      return letter.charCodeAt(0) - 65 // A=0, B=1, C=2, D=3
    }
  }

  return null
}
