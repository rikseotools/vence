/**
 * Variable Options Support — Baseline + Post-change Tests
 *
 * FASE 0 (baseline): Verifica el comportamiento actual con 4 opciones.
 * Después de los cambios, se añaden tests para 3 y 5 opciones.
 */

import { validateAnswerRequestSchema, validateAnswerResponseSchema } from '@/lib/api/answers/schemas'
import { saveAnswerRequestSchema } from '@/lib/api/exam/schemas'
import { saveOfficialExamAnswerRequestSchema } from '@/lib/api/official-exams/schemas'
import { answerAndSaveRequestSchema } from '@/lib/api/v2/answer-and-save/schemas'

// Valid UUIDs for Zod v4 (variant bits must be 8-b in position 19)
const UUID1 = 'a0000000-0000-4000-a000-000000000001'
const UUID2 = 'a0000000-0000-4000-a000-000000000002'

// ============================================
// BASELINE: Zod schemas con 4 opciones (0-3)
// ============================================

describe('Baseline: Zod schemas accept 4-option answers (0-3)', () => {
  test('validateAnswerRequestSchema accepts userAnswer 0-3', () => {
    for (let i = 0; i <= 3; i++) {
      const result = validateAnswerRequestSchema.safeParse({
        questionId: 'a0000000-0000-4000-a000-000000000001',
        userAnswer: i,
      })
      expect(result.success).toBe(true)
    }
  })

  test('validateAnswerRequestSchema accepts userAnswer 4 (5-option)', () => {
    const result = validateAnswerRequestSchema.safeParse({
      questionId: 'a0000000-0000-4000-a000-000000000001',
      userAnswer: 4,
    })
    expect(result.success).toBe(true)
  })

  test('validateAnswerRequestSchema rejects userAnswer 5', () => {
    const result = validateAnswerRequestSchema.safeParse({
      questionId: 'a0000000-0000-4000-a000-000000000001',
      userAnswer: 5,
    })
    expect(result.success).toBe(false)
  })

  test('validateAnswerRequestSchema rejects userAnswer -1', () => {
    const result = validateAnswerRequestSchema.safeParse({
      questionId: 'a0000000-0000-4000-a000-000000000001',
      userAnswer: -1,
    })
    expect(result.success).toBe(false)
  })

  test('validateAnswerResponseSchema accepts correctAnswer 0-4', () => {
    for (let i = 0; i <= 4; i++) {
      const result = validateAnswerResponseSchema.safeParse({
        success: true,
        isCorrect: true,
        correctAnswer: i,
        explanation: null,
      })
      expect(result.success).toBe(true)
    }
  })

  test('validateAnswerResponseSchema rejects correctAnswer 5', () => {
    const result = validateAnswerResponseSchema.safeParse({
      success: true,
      isCorrect: false,
      correctAnswer: 5,
      explanation: null,
    })
    expect(result.success).toBe(false)
  })
})

describe('Exam schemas accept letters a-e', () => {
  test('saveAnswerRequestSchema accepts a, b, c, d, e', () => {
    for (const letter of ['a', 'b', 'c', 'd', 'e']) {
      const result = saveAnswerRequestSchema.safeParse({
        testId: 'a0000000-0000-4000-a000-000000000001',
        questionOrder: 1,
        userAnswer: letter,
      })
      expect(result.success).toBe(true)
    }
  })

  test('saveAnswerRequestSchema rejects f', () => {
    const result = saveAnswerRequestSchema.safeParse({
      testId: 'a0000000-0000-4000-a000-000000000001',
      questionOrder: 1,
      userAnswer: 'f',
    })
    expect(result.success).toBe(false)
  })

  test('saveOfficialExamAnswerRequestSchema accepts a-e', () => {
    for (const letter of ['a', 'b', 'c', 'd', 'e']) {
      const result = saveOfficialExamAnswerRequestSchema.safeParse({
        testId: 'a0000000-0000-4000-a000-000000000001',
        questionOrder: 1,
        userAnswer: letter,
      })
      expect(result.success).toBe(true)
    }
  })

  test('saveOfficialExamAnswerRequestSchema rejects f', () => {
    const result = saveOfficialExamAnswerRequestSchema.safeParse({
      testId: 'a0000000-0000-4000-a000-000000000001',
      questionOrder: 1,
      userAnswer: 'f',
    })
    expect(result.success).toBe(false)
  })
})

describe('Baseline: v2 answer-and-save schema', () => {
  const basePayload = {
    questionId: 'a0000000-0000-4000-a000-000000000001',
    userAnswer: 0,
    isBlank: false,
    sessionId: 'a0000000-0000-4000-a000-000000000002',
    questionIndex: 0,
    questionText: 'Test question?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    tema: 1,
  }

  test('accepts userAnswer 0-3 with 4 options', () => {
    for (let i = 0; i <= 3; i++) {
      const result = answerAndSaveRequestSchema.safeParse({
        ...basePayload,
        userAnswer: i,
      })
      expect(result.success).toBe(true)
    }
  })

  test('accepts userAnswer 4 with 5 options', () => {
    const result = answerAndSaveRequestSchema.safeParse({
      ...basePayload,
      options: ['A', 'B', 'C', 'D', 'E'],
      userAnswer: 4,
    })
    expect(result.success).toBe(true)
  })

  test('rejects userAnswer 5', () => {
    const result = answerAndSaveRequestSchema.safeParse({
      ...basePayload,
      userAnswer: 5,
    })
    expect(result.success).toBe(false)
  })

  test('options array accepts 2-6 elements (already flexible)', () => {
    // 3 options
    const r3 = answerAndSaveRequestSchema.safeParse({
      ...basePayload,
      options: ['A', 'B', 'C'],
      userAnswer: 2,
    })
    expect(r3.success).toBe(true)

    // 5 options
    const r5 = answerAndSaveRequestSchema.safeParse({
      ...basePayload,
      options: ['A', 'B', 'C', 'D', 'E'],
      userAnswer: 3,
    })
    expect(r5.success).toBe(true)

    // 6 options
    const r6 = answerAndSaveRequestSchema.safeParse({
      ...basePayload,
      options: ['A', 'B', 'C', 'D', 'E', 'F'],
      userAnswer: 3,
    })
    expect(r6.success).toBe(true)

    // 1 option (too few)
    const r1 = answerAndSaveRequestSchema.safeParse({
      ...basePayload,
      options: ['A'],
      userAnswer: 0,
    })
    expect(r1.success).toBe(false)
  })
})

// ============================================
// LETTER/INDEX CONVERSION (current behavior)
// ============================================

describe('Baseline: Letter/Index conversion', () => {
  const lettersToIndex: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 }

  test('letters a-d map to indices 0-3', () => {
    for (const [letter, index] of Object.entries(lettersToIndex)) {
      expect(letter.charCodeAt(0) - 97).toBe(index)
    }
  })

  test('indices 0-3 map to letters A-D', () => {
    const letters = ['A', 'B', 'C', 'D']
    for (let i = 0; i < 4; i++) {
      expect(String.fromCharCode(65 + i)).toBe(letters[i])
    }
  })
})
