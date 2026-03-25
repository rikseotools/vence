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
  /⚠️\s*\*?\*?POSIBLE\s*ERROR/i,
  /⚠️\s*\*?\*?Posible\s+error\s+detectado/i,
  /ERROR\s*DETECTADO/i,
  // Solo detectar error si dice "debería ser" o "sería" (no "es" que es confirmación)
  /la\s+respuesta\s+correcta\s+(debería|sería)\s+/i,
  // ELIMINADOS P5 y P6: generaban falsos positivos cuando la IA explicaba
  // por qué las opciones incorrectas son incorrectas (ej: "contradice el artículo 147")
]

const CONFIRMATION_PATTERNS = [
  /es\s+correcta?\s+porque/i,
  /la\s+respuesta\s+.*\s+es\s+acertada/i,
  /efectivamente.*es\s+la\s+correcta/i,
  /confirmo\s+que\s+es\s+correcta/i,
]

// Patrones para detectar preguntas que piden la opción INCORRECTA/FALSA
const NEGATIVE_QUESTION_PATTERNS = [
  /señale.*incorrecta/i,
  /opción.*incorrecta/i,
  /respuesta.*incorrecta/i,
  /cuál.*NO\s+es/i,
  /NO\s+corresponde/i,
  /NO\s+es\s+un[oa]?\b/i,
  /señale.*falsa/i,
  /indique.*falsa/i,
  /\bEXCEPTO\b/i,
  /NO\s+está/i,
  /NO\s+son/i,
  /NO\s+puede/i,
  /NO\s+podrá/i,
  /NO\s+tendrá/i,
  /cuál.*es.*falsa/i,
]

// ============================================
// FUNCIONES PRINCIPALES
// ============================================

/**
 * Detecta si una pregunta pide identificar la opción INCORRECTA/FALSA
 * En estas preguntas, la respuesta correcta ES una afirmación falsa
 */
export function isNegativeQuestion(questionText: string): boolean {
  return NEGATIVE_QUESTION_PATTERNS.some(p => p.test(questionText))
}

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
  const letters = ['A', 'B', 'C', 'D']
  const otherOptions = letters.filter(l => l !== correctLetter)
  const isNegative = isNegativeQuestion(question.questionText)

  // Instrucción especial para preguntas negativas (piden la opción incorrecta/falsa)
  const negativeQuestionWarning = isNegative ? `
🔴 ATENCIÓN - PREGUNTA NEGATIVA:
Esta pregunta pide identificar la opción INCORRECTA o FALSA.
La respuesta ${correctLetter}) "${correctText}" es la respuesta correcta PORQUE es una afirmación FALSA.

IMPORTANTE:
- NO digas "posible error" porque la opción ${correctLetter} sea falsa - ESO ES LO QUE SE BUSCA
- Explica POR QUÉ la opción ${correctLetter} es FALSA según el artículo
- Confirma que las otras opciones (${otherOptions.join(', ')}) son VERDADERAS
- Tu respuesta debe empezar confirmando que ${correctLetter} es la correcta porque es la falsa

` : ''

  return `
${negativeQuestionWarning}📋 PROCESO DE ANÁLISIS:

RESPUESTA MARCADA COMO CORRECTA EN BD: ${correctLetter}) ${correctText}

PASO 1 - ANALIZA CADA OPCIÓN SISTEMÁTICAMENTE:
Para CADA opción (A, B, C, D):
- Busca el texto EXACTO en los artículos del contexto que la respalda o contradice
- Si una opción dice algo que el artículo NO dice → INCORRECTA
- Si una opción dice algo que el artículo SÍ dice LITERALMENTE → podría ser correcta

PASO 2 - DESCARTE POR ELIMINACIÓN:
- Elimina las opciones que claramente NO coinciden con el texto legal
- Identifica qué opciones PODRÍAN ser correctas según el artículo

PASO 3 - VERIFICA LA RESPUESTA ${correctLetter}:
- ¿El texto del artículo RESPALDA directamente la opción ${correctLetter}?
- Si SÍ → Confirma y explica por qué es correcta
- Si NO encuentras respaldo claro → La respuesta de BD suele ser correcta, explícala lo mejor posible

⚠️ DETECCIÓN DE ERRORES - MUY RESTRICTIVO:
SOLO indica "⚠️ POSIBLE ERROR" si cumples TODAS estas condiciones:
1. El artículo dice LITERALMENTE lo contrario a la opción ${correctLetter}
2. Otra opción (${otherOptions.join(' o ')}) coincide EXACTAMENTE con el texto del artículo
3. Puedes citar el texto EXACTO del artículo que contradice ${correctLetter}
4. NO es una cuestión de interpretación - es una contradicción clara y literal

Si tienes CUALQUIER duda, NO indiques error. La base de datos está revisada por expertos.

FORMATO DE RESPUESTA:
- Confirma cuál es la correcta
- Cita el artículo relevante
- Explica por qué las otras son incorrectas
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
