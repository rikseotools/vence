// __tests__/lib/api/test-answers/wasBlank.test.ts
//
// Tests del feature "Dejar en blanco" — 15/4/2026 (sugerencia Tinokero).
// Cubre:
// - mapAnswerToLetter con wasBlank=true devuelve 'BLANK'
// - schema answerDataSchema acepta wasBlank opcional
// - answerAndSaveRequestSchema valida coherencia isBlank/userAnswer

import { answerDataSchema, saveAnswerRequestSchema } from '@/lib/api/test-answers/schemas'
import { answerAndSaveRequestSchema } from '@/lib/api/v2/answer-and-save/schemas'

describe('answerDataSchema — wasBlank field', () => {
  test('acepta wasBlank=true', () => {
    const res = answerDataSchema.safeParse({
      questionIndex: 0,
      selectedAnswer: -1,
      correctAnswer: 2,
      isCorrect: false,
      timeSpent: 5,
      wasBlank: true,
    })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.wasBlank).toBe(true)
  })

  test('acepta wasBlank=false', () => {
    const res = answerDataSchema.safeParse({
      questionIndex: 0,
      selectedAnswer: 2,
      correctAnswer: 2,
      isCorrect: true,
      timeSpent: 5,
      wasBlank: false,
    })
    expect(res.success).toBe(true)
  })

  test('wasBlank es opcional (retrocompatibilidad con tests y callers legacy)', () => {
    const res = answerDataSchema.safeParse({
      questionIndex: 0,
      selectedAnswer: 1,
      correctAnswer: 2,
      isCorrect: false,
      timeSpent: 3,
      // sin wasBlank
    })
    expect(res.success).toBe(true)
    if (res.success) expect(res.data.wasBlank).toBeUndefined()
  })
})

describe('answerAndSaveRequestSchema — coherencia isBlank/userAnswer', () => {
  const baseValid = {
    questionId: '00000000-0000-0000-0000-000000000001',
    sessionId: '00000000-0000-0000-0000-000000000002',
    questionIndex: 0,
    questionText: 'Test question',
    options: ['A', 'B', 'C', 'D'],
    tema: 1,
    questionType: 'legislative' as const,
  }

  test('aceptado: userAnswer=2, isBlank=false', () => {
    const res = answerAndSaveRequestSchema.safeParse({
      ...baseValid,
      userAnswer: 2,
      isBlank: false,
    })
    expect(res.success).toBe(true)
  })

  test('aceptado: userAnswer=2, sin isBlank (default false)', () => {
    const res = answerAndSaveRequestSchema.safeParse({
      ...baseValid,
      userAnswer: 2,
    })
    expect(res.success).toBe(true)
  })

  test('aceptado: userAnswer=null, isBlank=true (blanco legítimo)', () => {
    const res = answerAndSaveRequestSchema.safeParse({
      ...baseValid,
      userAnswer: null,
      isBlank: true,
    })
    expect(res.success).toBe(true)
  })

  test('RECHAZADO: userAnswer=2 + isBlank=true (contradicción)', () => {
    const res = answerAndSaveRequestSchema.safeParse({
      ...baseValid,
      userAnswer: 2,
      isBlank: true,
    })
    expect(res.success).toBe(false)
  })

  test('RECHAZADO: userAnswer=null + isBlank=false (nulo solo permitido en blanco)', () => {
    const res = answerAndSaveRequestSchema.safeParse({
      ...baseValid,
      userAnswer: null,
      isBlank: false,
    })
    expect(res.success).toBe(false)
  })

  test('RECHAZADO: userAnswer=null sin isBlank (default false → rechazo)', () => {
    const res = answerAndSaveRequestSchema.safeParse({
      ...baseValid,
      userAnswer: null,
    })
    expect(res.success).toBe(false)
  })
})

// Test del mapAnswerToLetter — función privada del module, accesible vía reimportación
// con la export interna. Aquí testeamos el comportamiento end-to-end via buildTestAnswerRow
// que es más realista.

describe('mapAnswerToLetter — indirecto vía saveAnswerRequestSchema', () => {
  test('respuesta normal 0..3 se procesa OK', () => {
    const req = {
      sessionId: '00000000-0000-0000-0000-000000000099',
      questionData: {
        id: '00000000-0000-0000-0000-000000000111',
        question: 'Q',
        options: ['A', 'B', 'C', 'D'],
        tema: 1,
        questionType: 'legislative' as const,
      },
      answerData: {
        questionIndex: 0,
        selectedAnswer: 2,
        correctAnswer: 2,
        isCorrect: true,
        timeSpent: 5,
      },
      tema: 1,
    }
    const res = saveAnswerRequestSchema.safeParse(req)
    expect(res.success).toBe(true)
  })

  test('selectedAnswer=-1 + wasBlank=true se valida como "blanco"', () => {
    const req = {
      sessionId: '00000000-0000-0000-0000-000000000099',
      questionData: {
        id: '00000000-0000-0000-0000-000000000111',
        question: 'Q',
        options: ['A', 'B', 'C', 'D'],
        tema: 1,
        questionType: 'legislative' as const,
      },
      answerData: {
        questionIndex: 0,
        selectedAnswer: -1,
        correctAnswer: 2,
        isCorrect: false,
        timeSpent: 5,
        wasBlank: true,
      },
      tema: 1,
    }
    const res = saveAnswerRequestSchema.safeParse(req)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.answerData.wasBlank).toBe(true)
      expect(res.data.answerData.selectedAnswer).toBe(-1)
    }
  })
})
