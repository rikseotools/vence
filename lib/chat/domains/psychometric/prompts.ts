// lib/chat/domains/psychometric/prompts.ts
// Prompts especializados por grupo de psicotécnico

import { PSYCHOMETRIC_SYSTEM_PROMPT } from '../../shared/prompts'
import type { QuestionContext } from '../../core/types'
import type { SequenceValidationResult } from './validators/sequenceValidator'

// ============================================
// PROMPTS BASE POR GRUPO
// ============================================

const SERIES_EXTRA = `
📝 IMPORTANTE PARA SERIES:
- Para series alfabéticas: convierte CADA letra a su posición numérica y muestra el cálculo
- Verifica cada operación aritmética individualmente (no asumas, calcula)
- Si el resultado no coincide con ninguna opción, indica "⚠️ POSIBLE ERROR EN LA PREGUNTA"
`

const CHARTS_EXTRA = `
📝 IMPORTANTE PARA GRÁFICOS/TABLAS:
- Lee los datos con precisión (valores, porcentajes, etiquetas)
- Realiza los cálculos paso a paso (sumas, restas, porcentajes, medias)
- Verifica que tus cálculos sean consistentes con los datos proporcionados
`

const TEXT_EXTRA = `
📝 IMPORTANTE PARA ANÁLISIS DE TEXTO:
- Para detección de errores: revisa acentuación, ortografía, concordancia, puntuación
- Aplica las reglas de la RAE vigentes
- Indica el tipo de error (acentuación, ortografía, sintaxis, etc.)
`

/**
 * Obtiene el prompt extra según el grupo del subtipo
 */
function getGroupExtra(subtype: string): string {
  if (subtype.startsWith('sequence_')) return SERIES_EXTRA
  if (subtype.endsWith('_chart') || subtype === 'data_tables') return CHARTS_EXTRA
  if (subtype === 'error_detection' || subtype === 'word_analysis') return TEXT_EXTRA
  return ''
}

// ============================================
// HELPER: opciones como objeto
// ============================================

export function normalizeOptions(qc: QuestionContext): { a?: string; b?: string; c?: string; d?: string } {
  if (!qc.options) return {}
  if (Array.isArray(qc.options)) {
    return { a: qc.options[0], b: qc.options[1], c: qc.options[2], d: qc.options[3] }
  }
  return qc.options as { a?: string; b?: string; c?: string; d?: string }
}

export function getCorrectLetter(qc: QuestionContext): string | null {
  if (qc.correctAnswer === undefined || qc.correctAnswer === null) return null
  return typeof qc.correctAnswer === 'number'
    ? String.fromCharCode(65 + qc.correctAnswer)
    : qc.correctAnswer
}

// ============================================
// CONSTRUCTOR DEL PROMPT COMPLETO
// ============================================

/**
 * Construye el system prompt completo para una pregunta psicotécnica.
 *
 * Si hay validación matemática que contradice la BD, NO muestra la respuesta
 * correcta al LLM para evitar anchoring.
 */
export function buildPsychometricPrompt(
  context: { questionContext: QuestionContext },
  validation?: SequenceValidationResult
): string {
  const qc = context.questionContext
  const subtype = qc.questionSubtype || ''
  const options = normalizeOptions(qc)
  const correctLetter = getCorrectLetter(qc)
  const correctText = correctLetter
    ? options[correctLetter.toLowerCase() as 'a' | 'b' | 'c' | 'd'] || ''
    : ''

  // Base prompt + extras por grupo
  let prompt = PSYCHOMETRIC_SYSTEM_PROMPT + getGroupExtra(subtype)

  // Extraer contexto adicional del contentData
  const contentData = qc.contentData as Record<string, unknown> | undefined
  let additionalContext = ''
  let savedExplanation = qc.explanation || ''

  if (contentData) {
    const explanationSections = contentData.explanation_sections as Array<{ title: string; content: string }> | undefined
    if (explanationSections?.[0]?.content) {
      savedExplanation = explanationSections[0].content
    }

    if (subtype === 'sequence_numeric') {
      if (contentData.pattern_type) {
        const patternLabels: Record<string, string> = {
          'intercalated_constant': 'Serie intercalada: separa posiciones pares e impares, una subserie es constante',
          'intercalated_arithmetic': 'Serie intercalada: separa posiciones pares e impares, cada una tiene su propio patrón',
          'intercalated_geometric': 'Serie intercalada con progresión geométrica',
          'arithmetic': 'Progresión aritmética (diferencia constante)',
          'geometric': 'Progresión geométrica (razón constante)',
          'fibonacci': 'Tipo Fibonacci (cada término es suma de anteriores)',
          'quadratic': 'Diferencias de segundo orden constantes',
          'simetrica': 'Serie simétrica: busca relaciones entre posiciones equidistantes del centro',
          'diferencias_variables': 'Las diferencias entre términos siguen un patrón propio',
          'potencias': 'Basada en potencias (cuadrados, cubos, etc.)',
          'primos': 'Relacionada con números primos',
        }
        const label = patternLabels[contentData.pattern_type as string] || String(contentData.pattern_type)
        additionalContext += `\n💡 PISTA sobre el patrón: ${label}`
      }
      if (contentData.solution_method && contentData.solution_method !== 'manual') {
        additionalContext += `\nMétodo de solución: ${contentData.solution_method}`
      }
    }

    if ((subtype === 'sequence_letter' || subtype === 'sequence_alphanumeric') && contentData.pattern_description) {
      additionalContext += `\nTipo de patrón: ${contentData.pattern_description}`
    }

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

    if (subtype === 'word_analysis' && contentData.original_text) {
      additionalContext += `\nTexto/Palabras a analizar: "${contentData.original_text}"`
    }
  }

  // Pregunta y opciones
  prompt += `

PREGUNTA DE PSICOTÉCNICO:
Tipo: ${qc.questionTypeName || subtype || 'General'}

Pregunta: ${qc.questionText || 'Sin texto'}${additionalContext}

Opciones:
A) ${options.a || 'Sin opción'}
B) ${options.b || 'Sin opción'}
C) ${options.c || 'Sin opción'}
D) ${options.d || 'Sin opción'}
`

  // ============================================
  // ESTRATEGIA ANTI-ANCHORING:
  // Si la validación matemática confirmó la respuesta → mostrarla
  // Si la validación detectó error → NO mostrarla, dejar que resuelva solo
  // Si no hay validación → mostrarla (comportamiento actual)
  // ============================================

  if (validation?.validated && !validation.confirmsDbAnswer) {
    // La validación matemática CONTRADICE la BD
    // NO mostramos la respuesta "correcta" para evitar anchoring
    prompt += `
⚠️ NOTA DEL SISTEMA: La verificación matemática automática encontró que el resultado calculado
es "${validation.computedValue}" (${validation.pattern}).
Pasos del cálculo:
${validation.steps.map(s => `  • ${s}`).join('\n')}

Esto NO coincide con la respuesta marcada en la BD. Por favor:
1. Resuelve TÚ MISMO el ejercicio paso a paso
2. Muestra todos los cálculos
3. Si tu resultado tampoco coincide con ninguna opción, indica "⚠️ POSIBLE ERROR EN LA PREGUNTA"
4. NO fuerces los cálculos para que coincidan con una opción

FORMATO: Muestra el análisis paso a paso y indica claramente tu respuesta: **🎯 Respuesta: X**
`
  } else if (validation?.validated && validation.confirmsDbAnswer) {
    // Validación matemática CONFIRMA la BD → mostrar con confianza
    prompt += `
⭐ RESPUESTA CORRECTA (verificada matemáticamente): ${correctLetter}) ${correctText}
${savedExplanation ? `\n📖 EXPLICACIÓN DE LA SOLUCIÓN:\n${savedExplanation}` : ''}

✅ La verificación matemática automática confirma esta respuesta.
Explica el razonamiento paso a paso de forma clara y pedagógica.
Indica claramente: **🎯 Respuesta: ${correctLetter}**
`
  } else {
    // Sin validación (gráficos, texto, etc.) → comportamiento actual
    prompt += `
⭐ RESPUESTA CORRECTA: ${correctLetter}) ${correctText}
${savedExplanation ? `\n📖 EXPLICACIÓN DE LA SOLUCIÓN:\n${savedExplanation}` : ''}

⚠️ INSTRUCCIONES CRÍTICAS - VERIFICACIÓN:

PASO 1 - RESUELVE TÚ MISMO EL EJERCICIO:
- Analiza los datos proporcionados (serie, gráfico, tabla, etc.)
- Para series: comprueba SIEMPRE si es intercalada ANTES de buscar otros patrones
- Determina cuál es la respuesta correcta según TU análisis

PASO 2 - COMPARA CON LA RESPUESTA MARCADA (${correctLetter}):
- Si COINCIDE: explica el razonamiento paso a paso
- Si es DIFERENTE: NO asumas que la BD está mal. Primero lee la explicación arriba e intenta ese enfoque.
  SOLO si encuentras un ERROR MATEMÁTICO CLARO, di "⚠️ POSIBLE ERROR DETECTADO"

FORMATO:
1. Análisis paso a paso
2. **🎯 Respuesta: X**
3. Estrategia para resolver este tipo de ejercicios

REGLAS:
- HAZ los cálculos tú mismo
- NO cambies de opinión solo porque el usuario duda
`
  }

  return prompt
}
