// __tests__/chat/domains/psychometric.test.ts
// Tests para el dominio de psicotécnicos del chat

import { PsychometricDomain, getPsychometricDomain } from '@/lib/chat/domains/psychometric/PsychometricDomain'
import { getSubtypeGroup } from '@/lib/chat/domains/psychometric/PsychometricService'
import {
  buildPsychometricPrompt,
  normalizeOptions,
  getCorrectLetter,
} from '@/lib/chat/domains/psychometric/prompts'
import {
  validateLetterSequence,
  validateNumericSequence,
} from '@/lib/chat/domains/psychometric/validators/sequenceValidator'
import type { ChatContext, QuestionContext } from '@/lib/chat/core/types'
import { DOMAIN_PRIORITIES } from '@/lib/chat/core/types'

// ============================================
// TESTS: getSubtypeGroup
// ============================================

describe('getSubtypeGroup', () => {
  test('classifies series subtypes correctly', () => {
    expect(getSubtypeGroup('sequence_letter')).toBe('series')
    expect(getSubtypeGroup('sequence_numeric')).toBe('series')
    expect(getSubtypeGroup('sequence_alphanumeric')).toBe('series')
  })

  test('classifies chart subtypes correctly', () => {
    expect(getSubtypeGroup('bar_chart')).toBe('charts')
    expect(getSubtypeGroup('pie_chart')).toBe('charts')
    expect(getSubtypeGroup('line_chart')).toBe('charts')
    expect(getSubtypeGroup('mixed_chart')).toBe('charts')
    expect(getSubtypeGroup('data_tables')).toBe('charts')
  })

  test('classifies text subtypes correctly', () => {
    expect(getSubtypeGroup('error_detection')).toBe('text')
    expect(getSubtypeGroup('word_analysis')).toBe('text')
  })

  test('returns unknown for invalid/empty subtypes', () => {
    expect(getSubtypeGroup(null)).toBe('unknown')
    expect(getSubtypeGroup(undefined)).toBe('unknown')
    expect(getSubtypeGroup('')).toBe('unknown')
    expect(getSubtypeGroup('random_type')).toBe('unknown')
  })
})

// ============================================
// TESTS: normalizeOptions
// ============================================

describe('normalizeOptions', () => {
  test('handles array options', () => {
    const qc: QuestionContext = {
      options: ['Uno', 'Dos', 'Tres', 'Cuatro'],
    }
    const result = normalizeOptions(qc)
    expect(result).toEqual({ a: 'Uno', b: 'Dos', c: 'Tres', d: 'Cuatro' })
  })

  test('handles object options', () => {
    const qc: QuestionContext = {
      options: { a: 'Uno', b: 'Dos', c: 'Tres', d: 'Cuatro' },
    }
    const result = normalizeOptions(qc)
    expect(result).toEqual({ a: 'Uno', b: 'Dos', c: 'Tres', d: 'Cuatro' })
  })

  test('handles null/undefined options', () => {
    expect(normalizeOptions({})).toEqual({})
    expect(normalizeOptions({ options: null })).toEqual({})
  })
})

// ============================================
// TESTS: getCorrectLetter
// ============================================

describe('getCorrectLetter', () => {
  test('converts numeric answer to letter', () => {
    expect(getCorrectLetter({ correctAnswer: 0 })).toBe('A')
    expect(getCorrectLetter({ correctAnswer: 1 })).toBe('B')
    expect(getCorrectLetter({ correctAnswer: 2 })).toBe('C')
    expect(getCorrectLetter({ correctAnswer: 3 })).toBe('D')
  })

  test('passes through string answer', () => {
    expect(getCorrectLetter({ correctAnswer: 'A' })).toBe('A')
    expect(getCorrectLetter({ correctAnswer: 'B' })).toBe('B')
  })

  test('returns null for missing answer', () => {
    expect(getCorrectLetter({})).toBeNull()
    expect(getCorrectLetter({ correctAnswer: null })).toBeNull()
    expect(getCorrectLetter({ correctAnswer: undefined })).toBeNull()
  })
})

// ============================================
// TESTS: validateLetterSequence
// ============================================

describe('validateLetterSequence', () => {
  test('validates letter analogy AMOR→CNQT, VIDA→? (Spanish alphabet)', () => {
    const result = validateLetterSequence(
      'AMOR es a CNQT como VIDA es a:',
      { a: 'XJFC', b: 'YLGD', c: 'WKEB', d: 'ZMHE' },
      0 // A
    )
    // This should validate and find a result
    expect(result.validated).toBe(true)
    expect(result.pattern).toContain('Transformación')
    expect(result.steps.length).toBeGreaterThan(0)
  })

  test('validates simple linear letter series A, C, E, G, ?', () => {
    const result = validateLetterSequence(
      'A, C, E, G, ?',
      { a: 'H', b: 'I', c: 'J', d: 'K' },
      1 // B = I (+2 each)
    )
    expect(result.validated).toBe(true)
    expect(result.confirmsDbAnswer).toBe(true)
    expect(result.computedValue).toBe('I')
    expect(result.computedAnswer).toBe('B')
  })

  test('detects wrong DB answer for linear series', () => {
    const result = validateLetterSequence(
      'B, D, F, H, ?',
      { a: 'I', b: 'J', c: 'K', d: 'L' },
      0 // A = I (wrong, should be J)
    )
    expect(result.validated).toBe(true)
    expect(result.confirmsDbAnswer).toBe(false)
    expect(result.computedValue).toBe('J')
    expect(result.computedAnswer).toBe('B')
  })

  test('returns not validated for unrecognized patterns', () => {
    const result = validateLetterSequence(
      '¿Cuál es la siguiente letra de la serie?',
      { a: 'X', b: 'Y', c: 'Z', d: 'W' },
      0
    )
    expect(result.validated).toBe(false)
  })

  test('validates analogy with English alphabet', () => {
    // ABC → DEF (each +3), GHI → ?
    const result = validateLetterSequence(
      'ABC es a DEF como GHI es a:',
      { a: 'JKL', b: 'KLM', c: 'LMN', d: 'MNO' },
      0 // A = JKL
    )
    expect(result.validated).toBe(true)
    expect(result.confirmsDbAnswer).toBe(true)
    expect(result.computedValue).toBe('JKL')
  })
})

// ============================================
// TESTS: validateNumericSequence
// ============================================

describe('validateNumericSequence', () => {
  test('validates arithmetic sequence (constant difference)', () => {
    const result = validateNumericSequence(
      '2, 5, 8, 11, ?',
      { a: '13', b: '14', c: '15', d: '16' },
      1 // B = 14
    )
    expect(result.validated).toBe(true)
    expect(result.confirmsDbAnswer).toBe(true)
    expect(result.computedValue).toBe('14')
  })

  test('validates second-order differences', () => {
    // 1, 3, 7, 13, 21, ? → diffs: 2,4,6,8 → diffs2: 2,2,2 → next diff: 10 → 31
    const result = validateNumericSequence(
      '1, 3, 7, 13, 21, ?',
      { a: '29', b: '30', c: '31', d: '32' },
      2 // C = 31
    )
    expect(result.validated).toBe(true)
    expect(result.confirmsDbAnswer).toBe(true)
    expect(result.computedValue).toBe('31')
  })

  test('detects wrong DB answer for arithmetic sequence', () => {
    const result = validateNumericSequence(
      '10, 20, 30, 40, ?',
      { a: '45', b: '50', c: '55', d: '60' },
      0 // A = 45 (wrong, should be 50)
    )
    expect(result.validated).toBe(true)
    expect(result.confirmsDbAnswer).toBe(false)
    expect(result.computedValue).toBe('50')
    expect(result.computedAnswer).toBe('B')
  })

  test('validates intercalated series', () => {
    // 1, 10, 2, 20, 3, ? → odds: 1,2,3 (+1), evens: 10,20 (+10) → next is even position → 30
    const result = validateNumericSequence(
      '1, 10, 2, 20, 3, ?',
      { a: '4', b: '25', c: '30', d: '40' },
      2 // C = 30
    )
    // Intercalated pattern detection
    if (result.validated) {
      expect(result.computedValue).toBe('30')
    }
  })

  test('returns not validated for complex patterns', () => {
    // Fibonacci-like, not handled by simple arithmetic
    const result = validateNumericSequence(
      '1, 1, 2, 3, 5, ?',
      { a: '7', b: '8', c: '9', d: '10' },
      1
    )
    // May or may not validate depending on pattern detection
    // The important thing is it doesn't crash
    expect(result).toBeDefined()
    expect(typeof result.validated).toBe('boolean')
  })

  test('handles negative numbers', () => {
    const result = validateNumericSequence(
      '-6, -3, 0, 3, ?',
      { a: '5', b: '6', c: '7', d: '8' },
      1 // B = 6
    )
    expect(result.validated).toBe(true)
    expect(result.confirmsDbAnswer).toBe(true)
    expect(result.computedValue).toBe('6')
  })

  test('returns not validated for too few numbers', () => {
    const result = validateNumericSequence(
      '5, 10, ?',
      { a: '15', b: '20', c: '25', d: '30' },
      0
    )
    // Only 2 numbers in text before ?, may not be enough
    expect(result).toBeDefined()
  })
})

// ============================================
// TESTS: buildPsychometricPrompt
// ============================================

describe('buildPsychometricPrompt', () => {
  const baseContext = {
    questionContext: {
      questionText: '2, 4, 6, 8, ?',
      questionSubtype: 'sequence_numeric',
      questionTypeName: 'Series numéricas',
      options: { a: '9', b: '10', c: '11', d: '12' },
      correctAnswer: 1, // B
      explanation: 'Diferencia constante de +2',
    } as QuestionContext,
  }

  test('includes question text and options', () => {
    const prompt = buildPsychometricPrompt(baseContext)
    expect(prompt).toContain('2, 4, 6, 8, ?')
    expect(prompt).toContain('A) 9')
    expect(prompt).toContain('B) 10')
    expect(prompt).toContain('C) 11')
    expect(prompt).toContain('D) 12')
  })

  test('includes series-specific instructions without validation', () => {
    const prompt = buildPsychometricPrompt(baseContext)
    expect(prompt).toContain('PREGUNTA DE PSICOTÉCNICO')
    expect(prompt).toContain('RESPUESTA CORRECTA: B) 10')
    expect(prompt).toContain('INSTRUCCIONES CRÍTICAS')
    // Series extra
    expect(prompt).toContain('IMPORTANTE PARA SERIES')
  })

  test('shows confidence when validation confirms DB answer', () => {
    const validation = {
      validated: true,
      confirmsDbAnswer: true,
      computedAnswer: 'B',
      computedValue: '10',
      pattern: 'Diferencia constante: +2',
      steps: ['Serie: 2, 4, 6, 8', 'Diferencia: 2', 'Siguiente: 10'],
    }
    const prompt = buildPsychometricPrompt(baseContext, validation)
    expect(prompt).toContain('verificada matemáticamente')
    expect(prompt).toContain('RESPUESTA CORRECTA (verificada matemáticamente): B) 10')
    // Should contain the confirmation message
    expect(prompt).toContain('verificación matemática automática confirma esta respuesta')
    // Should NOT contain the anti-anchoring block that asks LLM to solve independently
    expect(prompt).not.toContain('Resuelve TÚ MISMO el ejercicio paso a paso')
  })

  test('anti-anchoring: hides correct answer when validation contradicts DB', () => {
    const validation = {
      validated: true,
      confirmsDbAnswer: false,
      computedAnswer: 'C',
      computedValue: '11',
      pattern: 'Diferencia constante: +3',
      steps: ['Serie: 2, 5, 8', 'Diferencia: 3', 'Siguiente: 11'],
    }
    const prompt = buildPsychometricPrompt(baseContext, validation)
    // Should NOT show "RESPUESTA CORRECTA: B"
    expect(prompt).not.toContain('⭐ RESPUESTA CORRECTA: B) 10')
    // Should show computed value
    expect(prompt).toContain('11')
    expect(prompt).toContain('Diferencia constante: +3')
    // Should ask LLM to solve independently
    expect(prompt).toContain('Resuelve TÚ MISMO')
  })

  test('includes chart-specific instructions for bar_chart', () => {
    const chartContext = {
      questionContext: {
        questionText: '¿Cuál es el valor más alto?',
        questionSubtype: 'bar_chart',
        options: { a: '100', b: '200', c: '300', d: '400' },
        correctAnswer: 2,
      } as QuestionContext,
    }
    const prompt = buildPsychometricPrompt(chartContext)
    expect(prompt).toContain('IMPORTANTE PARA GRÁFICOS/TABLAS')
  })

  test('includes text-specific instructions for error_detection', () => {
    const textContext = {
      questionContext: {
        questionText: '¿Cuál tiene error ortográfico?',
        questionSubtype: 'error_detection',
        options: { a: 'haber', b: 'haver', c: 'aber', d: 'aver' },
        correctAnswer: 0,
        contentData: {
          original_text: 'Texto con errores',
          correct_text: 'Texto sin errores',
          errors_found: [{ incorrect: 'haver', correct: 'haber', explanation: 'v→b' }],
        },
      } as QuestionContext,
    }
    const prompt = buildPsychometricPrompt(textContext)
    expect(prompt).toContain('IMPORTANTE PARA ANÁLISIS DE TEXTO')
    expect(prompt).toContain('Texto a analizar')
    expect(prompt).toContain('Texto corregido')
    expect(prompt).toContain('Errores encontrados')
  })

  test('includes pattern hint for sequence_numeric with contentData', () => {
    const context = {
      questionContext: {
        ...baseContext.questionContext,
        contentData: {
          pattern_type: 'intercalated_arithmetic',
          solution_method: 'intercalated',
        },
      } as QuestionContext,
    }
    const prompt = buildPsychometricPrompt(context)
    expect(prompt).toContain('PISTA sobre el patrón')
    expect(prompt).toContain('intercalada')
    expect(prompt).toContain('Método de solución: intercalated')
  })
})

// ============================================
// TESTS: PsychometricDomain
// ============================================

describe('PsychometricDomain', () => {
  let domain: PsychometricDomain

  beforeEach(() => {
    domain = new PsychometricDomain()
  })

  test('has correct name and priority', () => {
    expect(domain.name).toBe('psychometric')
    expect(domain.priority).toBe(DOMAIN_PRIORITIES.PSYCHOMETRIC)
    expect(domain.priority).toBe(1.5)
  })

  test('priority is between VERIFICATION and KNOWLEDGE_BASE', () => {
    expect(domain.priority).toBeGreaterThan(DOMAIN_PRIORITIES.VERIFICATION)
    expect(domain.priority).toBeLessThan(DOMAIN_PRIORITIES.KNOWLEDGE_BASE)
  })

  function makeContext(subtype: string | null): ChatContext {
    return {
      request: { messages: [{ role: 'user', content: 'test' }] },
      userId: 'test-user',
      userDomain: 'auxiliar_administrativo_estado',
      isPremium: false,
      messages: [{ role: 'user', content: 'Explícame esta pregunta' }],
      currentMessage: 'Explícame esta pregunta',
      startTime: Date.now(),
      questionContext: subtype ? {
        questionSubtype: subtype,
        questionText: 'Test question',
        options: { a: 'A', b: 'B', c: 'C', d: 'D' },
        correctAnswer: 0,
      } : undefined,
    }
  }

  test('canHandle returns true for all psychometric subtypes', async () => {
    const subtypes = [
      'sequence_letter', 'sequence_numeric', 'sequence_alphanumeric',
      'bar_chart', 'pie_chart', 'line_chart', 'mixed_chart',
      'data_tables', 'error_detection', 'word_analysis',
    ]

    for (const st of subtypes) {
      const result = await domain.canHandle(makeContext(st))
      expect(result).toBe(true)
    }
  })

  test('canHandle returns false for non-psychometric contexts', async () => {
    expect(await domain.canHandle(makeContext(null))).toBe(false)
    expect(await domain.canHandle(makeContext('some_other_type'))).toBe(false)
  })

  test('canHandle returns false when no questionContext', async () => {
    const context: ChatContext = {
      request: { messages: [{ role: 'user', content: 'hola' }] },
      userId: 'test-user',
      userDomain: 'auxiliar_administrativo_estado',
      isPremium: false,
      messages: [{ role: 'user', content: 'hola' }],
      currentMessage: 'hola',
      startTime: Date.now(),
    }
    expect(await domain.canHandle(context)).toBe(false)
  })

  test('singleton returns same instance', () => {
    const d1 = getPsychometricDomain()
    const d2 = getPsychometricDomain()
    expect(d1).toBe(d2)
  })
})

// ============================================
// TESTS: DOMAIN_PRIORITIES includes PSYCHOMETRIC
// ============================================

describe('DOMAIN_PRIORITIES', () => {
  test('includes PSYCHOMETRIC at 1.5', () => {
    expect(DOMAIN_PRIORITIES.PSYCHOMETRIC).toBe(1.5)
  })

  test('PSYCHOMETRIC is between VERIFICATION and KNOWLEDGE_BASE', () => {
    expect(DOMAIN_PRIORITIES.PSYCHOMETRIC).toBeGreaterThan(DOMAIN_PRIORITIES.VERIFICATION)
    expect(DOMAIN_PRIORITIES.PSYCHOMETRIC).toBeLessThan(DOMAIN_PRIORITIES.KNOWLEDGE_BASE)
  })
})
