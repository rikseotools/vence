// lib/chat/domains/psychometric/validators/sequenceValidator.ts
// Validador matemático determinista para preguntas de series

/**
 * Resultado de la validación matemática de una serie.
 * Si validated=false, no se pudo verificar y el LLM opera como antes.
 */
export interface SequenceValidationResult {
  validated: boolean
  confirmsDbAnswer: boolean
  computedAnswer: string | null   // letra A-D o null
  computedValue: string | null    // valor calculado (ej: "XJFC", "42")
  pattern: string | null          // descripción del patrón encontrado
  steps: string[]                 // pasos del cálculo para incluir en prompt
}

const NOT_VALIDATED: SequenceValidationResult = {
  validated: false,
  confirmsDbAnswer: false,
  computedAnswer: null,
  computedValue: null,
  pattern: null,
  steps: [],
}

// Alfabeto español de 27 letras (con ñ)
const ALPHA_ES = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'
// Alfabeto inglés de 26 letras (sin ñ)
const ALPHA_EN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function letterPos(letter: string, alpha: string): number {
  return alpha.indexOf(letter.toUpperCase()) + 1
}

function posToLetter(pos: number, alpha: string): string {
  const len = alpha.length
  // Wraparound
  let p = ((pos - 1) % len + len) % len
  return alpha[p]
}

/**
 * Valida una pregunta de serie alfabética (sequence_letter).
 * Intenta detectar el patrón de transformación y verificar la respuesta.
 */
export function validateLetterSequence(
  questionText: string,
  options: { a?: string; b?: string; c?: string; d?: string },
  correctOption: number,
  contentData?: Record<string, unknown>
): SequenceValidationResult {
  // Detectar si es una analogía tipo "XXXX es a YYYY como ZZZZ es a:"
  const analogyMatch = questionText.match(
    /([A-ZÑÁÉÍÓÚ]{2,})\s+es\s+a\s+([A-ZÑÁÉÍÓÚ]{2,})\s+como\s+([A-ZÑÁÉÍÓÚ]{2,})\s+es\s+a/i
  )

  if (analogyMatch) {
    return validateLetterAnalogy(
      analogyMatch[1].toUpperCase(),
      analogyMatch[2].toUpperCase(),
      analogyMatch[3].toUpperCase(),
      options,
      correctOption
    )
  }

  // Detectar serie lineal de letras en varios formatos:
  // Formato 1: A, C, E, G, ? (comas)
  // Formato 2: A-C-E-G-? (guiones)
  // Formato 3: A C E G ? (espacios)
  const SEP = '[,→\\-–\\s]'  // separadores posibles
  const linearRegex = new RegExp(
    `([A-ZÑ])\\s*${SEP}\\s*([A-ZÑ])\\s*${SEP}\\s*([A-ZÑ])` +
    `(?:\\s*${SEP}\\s*([A-ZÑ]))?` +
    `(?:\\s*${SEP}\\s*([A-ZÑ]))?` +
    `(?:\\s*${SEP}\\s*([A-ZÑ]))?` +
    `(?:\\s*${SEP}\\s*([A-ZÑ]))?` +
    `(?:\\s*${SEP}\\s*([A-ZÑ]))?` +
    `\\s*${SEP}\\s*\\??`,
    'i'
  )
  const linearMatch = questionText.match(linearRegex)

  if (linearMatch) {
    const letters = [linearMatch[1], linearMatch[2], linearMatch[3], linearMatch[4],
      linearMatch[5], linearMatch[6], linearMatch[7], linearMatch[8]]
      .filter(Boolean)
      .map(l => l.toUpperCase())
    if (letters.length >= 3) {
      return validateLinearLetterSeries(letters, options, correctOption)
    }
  }

  return NOT_VALIDATED
}

/**
 * Valida analogía de transformación: WORD1 → WORD2, aplicar a WORD3
 */
function validateLetterAnalogy(
  word1: string,
  word2: string,
  word3: string,
  options: { a?: string; b?: string; c?: string; d?: string },
  correctOption: number
): SequenceValidationResult {
  if (word1.length !== word2.length || word1.length !== word3.length) {
    return NOT_VALIDATED
  }

  // Probar con ambos alfabetos (primero español que es más común en oposiciones)
  let fallbackResult: SequenceValidationResult | null = null

  for (const alpha of [ALPHA_ES, ALPHA_EN]) {
    const alphaName = alpha.length === 26 ? '26 letras' : '27 letras (con ñ)'

    // Calcular patrón de diferencias
    const diffs: number[] = []
    let allValid = true

    for (let i = 0; i < word1.length; i++) {
      const p1 = letterPos(word1[i], alpha)
      const p2 = letterPos(word2[i], alpha)
      if (p1 === 0 || p2 === 0) { allValid = false; break }
      diffs.push(p2 - p1)
    }

    if (!allValid) continue

    // Aplicar patrón a word3
    let result = ''
    const steps: string[] = []
    steps.push(`Patrón ${word1}→${word2} (${alphaName}): ${diffs.map((d, i) => `${word1[i]}(${letterPos(word1[i], alpha)})→${word2[i]}(${letterPos(word2[i], alpha)})=${d >= 0 ? '+' : ''}${d}`).join(', ')}`)

    for (let i = 0; i < word3.length; i++) {
      const p3 = letterPos(word3[i], alpha)
      if (p3 === 0) { allValid = false; break }
      const newPos = p3 + diffs[i]
      const newLetter = posToLetter(newPos, alpha)
      result += newLetter
      steps.push(`${word3[i]}(${p3}) + ${diffs[i]} = ${newPos} → ${newLetter}`)
    }

    if (!allValid) continue

    // Comparar con opciones
    const optionValues = [options.a, options.b, options.c, options.d]
    const matchIdx = optionValues.findIndex(
      o => o?.toUpperCase().trim() === result
    )

    if (matchIdx >= 0) {
      // Coincide con una opción → retornar directamente
      const computedLetter = ['A', 'B', 'C', 'D'][matchIdx]
      return {
        validated: true,
        confirmsDbAnswer: matchIdx === correctOption,
        computedAnswer: computedLetter,
        computedValue: result,
        pattern: `Transformación ${diffs.map(d => (d >= 0 ? '+' : '') + d).join(',')} (${alphaName})`,
        steps,
      }
    }

    // No coincide con ninguna opción → guardar como fallback y probar otro alfabeto
    if (!fallbackResult) {
      steps.push(`Resultado ${result} no coincide con ninguna opción`)
      fallbackResult = {
        validated: true,
        confirmsDbAnswer: false,
        computedAnswer: null,
        computedValue: result,
        pattern: `Transformación ${diffs.map(d => (d >= 0 ? '+' : '') + d).join(',')} (${alphaName})`,
        steps,
      }
    }
  }

  // Si ningún alfabeto dio match con opciones, retornar el fallback
  return fallbackResult || NOT_VALIDATED
}

/**
 * Valida serie lineal de letras: encuentra el patrón y predice la siguiente
 */
function validateLinearLetterSeries(
  letters: string[],
  options: { a?: string; b?: string; c?: string; d?: string },
  correctOption: number
): SequenceValidationResult {
  if (letters.length < 3) return NOT_VALIDATED

  for (const alpha of [ALPHA_ES, ALPHA_EN]) {
    const positions = letters.map(l => letterPos(l, alpha))
    if (positions.some(p => p === 0)) continue

    // Calcular diferencias
    const diffs: number[] = []
    for (let i = 1; i < positions.length; i++) {
      diffs.push(positions[i] - positions[i - 1])
    }

    // Verificar diferencia constante
    const allSame = diffs.every(d => d === diffs[0])
    if (allSame) {
      const nextPos = positions[positions.length - 1] + diffs[0]
      const nextLetter = posToLetter(nextPos, alpha)

      const optionValues = [options.a, options.b, options.c, options.d]
      const matchIdx = optionValues.findIndex(
        o => o?.toUpperCase().trim() === nextLetter
      )

      if (matchIdx >= 0) {
        return {
          validated: true,
          confirmsDbAnswer: matchIdx === correctOption,
          computedAnswer: ['A', 'B', 'C', 'D'][matchIdx],
          computedValue: nextLetter,
          pattern: `Diferencia constante: ${diffs[0] >= 0 ? '+' : ''}${diffs[0]}`,
          steps: [`Posiciones: ${positions.join(', ')}`, `Diferencia: ${diffs[0]}`, `Siguiente: ${nextPos} → ${nextLetter}`],
        }
      }
    }
  }

  return NOT_VALIDATED
}

/**
 * Valida una pregunta de serie numérica (sequence_numeric).
 */
export function validateNumericSequence(
  questionText: string,
  options: { a?: string; b?: string; c?: string; d?: string },
  correctOption: number,
  contentData?: Record<string, unknown>
): SequenceValidationResult {
  // Extraer números de la serie
  const numbers = extractNumbersFromText(questionText)
  if (numbers.length < 3) return NOT_VALIDATED

  // Intentar patrón aritmético simple
  const arithmeticResult = tryArithmeticPattern(numbers, options, correctOption)
  if (arithmeticResult.validated) return arithmeticResult

  // Intentar series intercaladas
  const intercalatedResult = tryIntercalatedPattern(numbers, options, correctOption)
  if (intercalatedResult.validated) return intercalatedResult

  return NOT_VALIDATED
}

function extractNumbersFromText(text: string): number[] {
  // Buscar la parte de la serie en el texto (antes del ?)
  const seriesPart = text.split('?')[0] || text

  // Detectar si usa hyphens como separador (ej: "1-3-5-7-9-11-?")
  // Patrón: dígito seguido de hyphen seguido de dígito (sin espacio = separador)
  const usesHyphenSep = /\d\s*-\s*\d/.test(seriesPart) && !/\d\s*,\s*\d/.test(seriesPart)

  if (usesHyphenSep) {
    // Tratar hyphens como separadores, no como signos negativos
    // Separar por hyphens y extraer números de cada parte
    const parts = seriesPart.split(/[-–]/)
    return parts
      .map(p => p.trim())
      .filter(p => /\d/.test(p))
      .map(p => {
        const m = p.match(/\d+(?:[.,]\d+)?/)
        return m ? parseFloat(m[0].replace(',', '.')) : NaN
      })
      .filter(n => !isNaN(n))
  }

  // Formato normal (comas, espacios, etc.)
  const matches = text.match(/-?\d+(?:[.,]\d+)?/g)
  if (!matches) return []

  return matches
    .map(m => parseFloat(m.replace(',', '.')))
    .filter(n => !isNaN(n))
}

function tryArithmeticPattern(
  numbers: number[],
  options: { a?: string; b?: string; c?: string; d?: string },
  correctOption: number
): SequenceValidationResult {
  const diffs: number[] = []
  for (let i = 1; i < numbers.length; i++) {
    diffs.push(numbers[i] - numbers[i - 1])
  }

  // Diferencia constante
  if (diffs.length >= 2 && diffs.every(d => Math.abs(d - diffs[0]) < 0.001)) {
    const next = numbers[numbers.length - 1] + diffs[0]
    return matchWithOptions(next, options, correctOption, `Diferencia constante: ${diffs[0]}`, [
      `Serie: ${numbers.join(', ')}`,
      `Diferencias: ${diffs.join(', ')}`,
      `Siguiente: ${numbers[numbers.length - 1]} + ${diffs[0]} = ${next}`,
    ])
  }

  // Diferencias de segundo orden constantes
  if (diffs.length >= 3) {
    const diffs2: number[] = []
    for (let i = 1; i < diffs.length; i++) {
      diffs2.push(diffs[i] - diffs[i - 1])
    }
    if (diffs2.every(d => Math.abs(d - diffs2[0]) < 0.001)) {
      const nextDiff = diffs[diffs.length - 1] + diffs2[0]
      const next = numbers[numbers.length - 1] + nextDiff
      return matchWithOptions(next, options, correctOption, `Diferencias de 2º orden: ${diffs2[0]}`, [
        `Serie: ${numbers.join(', ')}`,
        `Diferencias 1er orden: ${diffs.join(', ')}`,
        `Diferencias 2do orden: ${diffs2.join(', ')} (constante)`,
        `Siguiente diferencia: ${nextDiff}`,
        `Siguiente: ${numbers[numbers.length - 1]} + ${nextDiff} = ${next}`,
      ])
    }
  }

  return NOT_VALIDATED
}

function tryIntercalatedPattern(
  numbers: number[],
  options: { a?: string; b?: string; c?: string; d?: string },
  correctOption: number
): SequenceValidationResult {
  // Need at least 6 numbers to reliably detect intercalated (3 per subsequence)
  if (numbers.length < 6) return NOT_VALIDATED

  // Separar pares e impares
  const odds = numbers.filter((_, i) => i % 2 === 0)
  const evens = numbers.filter((_, i) => i % 2 === 1)

  // Verificar si alguna subserie es aritmética
  for (const [subserie, name, positionParity] of [
    [odds, 'impares (1,3,5...)', 'odd'],
    [evens, 'pares (2,4,6...)', 'even'],
  ] as const) {
    if (subserie.length < 2) continue
    const diffs: number[] = []
    for (let i = 1; i < subserie.length; i++) {
      diffs.push(subserie[i] - subserie[i - 1])
    }

    if (diffs.every(d => Math.abs(d - diffs[0]) < 0.001)) {
      // Esta subserie tiene patrón constante
      // ¿La posición faltante (?) está en esta subserie o en la otra?
      // Asumimos que el ? está al final
      const isOddPosition = numbers.length % 2 === 0 // next position is odd if current length is even
      const nextFromOdds = isOddPosition
      const targetSubserie = nextFromOdds ? odds : evens
      const targetDiffs = nextFromOdds ? diffs : (() => {
        const d: number[] = []
        for (let i = 1; i < evens.length; i++) d.push(evens[i] - evens[i - 1])
        return d
      })()

      if (targetDiffs.length > 0 && targetDiffs.every(d => Math.abs(d - targetDiffs[0]) < 0.001)) {
        const next = targetSubserie[targetSubserie.length - 1] + targetDiffs[0]
        return matchWithOptions(next, options, correctOption, `Serie intercalada`, [
          `Posiciones ${name}: ${subserie.join(', ')}`,
          `Diferencia: ${diffs[0]}`,
          `Siguiente: ${next}`,
        ])
      }
    }
  }

  return NOT_VALIDATED
}

function matchWithOptions(
  value: number,
  options: { a?: string; b?: string; c?: string; d?: string },
  correctOption: number,
  pattern: string,
  steps: string[]
): SequenceValidationResult {
  const optionValues = [options.a, options.b, options.c, options.d]
  const matchIdx = optionValues.findIndex(o => {
    if (!o) return false
    const num = parseFloat(o.replace(',', '.').trim())
    return !isNaN(num) && Math.abs(num - value) < 0.001
  })

  if (matchIdx >= 0) {
    return {
      validated: true,
      confirmsDbAnswer: matchIdx === correctOption,
      computedAnswer: ['A', 'B', 'C', 'D'][matchIdx],
      computedValue: String(value),
      pattern,
      steps,
    }
  }

  steps.push(`Valor calculado ${value} no coincide con ninguna opción`)
  return {
    validated: true,
    confirmsDbAnswer: false,
    computedAnswer: null,
    computedValue: String(value),
    pattern,
    steps,
  }
}
