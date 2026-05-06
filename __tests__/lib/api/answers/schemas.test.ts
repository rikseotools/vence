// __tests__/lib/api/answers/schemas.test.ts
// Tests del validateAnswerRequestSchema — incluye el caso -1 (blank/skipped).

import { safeParseAnswerRequest } from '@/lib/api/answers/schemas'

const VALID_QUESTION_ID = '550e8400-e29b-41d4-a716-446655440000'

describe('validateAnswerRequestSchema', () => {
  describe('userAnswer válidos', () => {
    test.each([
      ['blank/skip', -1],
      ['A', 0],
      ['B', 1],
      ['C', 2],
      ['D', 3],
      ['E (futuro)', 4],
    ])('acepta %s (%i)', (_label, value) => {
      const r = safeParseAnswerRequest({
        questionId: VALID_QUESTION_ID,
        userAnswer: value,
      })
      expect(r.success).toBe(true)
    })
  })

  describe('userAnswer inválidos', () => {
    test.each([
      ['-2 (blank "doble")', -2],
      ['5 (fuera de rango)', 5],
      ['100 (muy alto)', 100],
      ['1.5 (no integer)', 1.5],
    ])('rechaza %s', (_label, value) => {
      const r = safeParseAnswerRequest({
        questionId: VALID_QUESTION_ID,
        userAnswer: value,
      })
      expect(r.success).toBe(false)
    })

    test('rechaza string', () => {
      const r = safeParseAnswerRequest({
        questionId: VALID_QUESTION_ID,
        userAnswer: 'A',
      })
      expect(r.success).toBe(false)
    })

    test('rechaza null', () => {
      const r = safeParseAnswerRequest({
        questionId: VALID_QUESTION_ID,
        userAnswer: null,
      })
      expect(r.success).toBe(false)
    })
  })

  describe('questionId', () => {
    test('rechaza UUID inválido', () => {
      const r = safeParseAnswerRequest({
        questionId: 'not-a-uuid',
        userAnswer: 0,
      })
      expect(r.success).toBe(false)
    })

    test('rechaza string vacío', () => {
      const r = safeParseAnswerRequest({
        questionId: '',
        userAnswer: 0,
      })
      expect(r.success).toBe(false)
    })
  })

  describe('campos opcionales', () => {
    test('userId opcional — UUID válido', () => {
      const r = safeParseAnswerRequest({
        questionId: VALID_QUESTION_ID,
        userAnswer: 0,
        userId: VALID_QUESTION_ID,
      })
      expect(r.success).toBe(true)
    })

    test('userId puede ser null', () => {
      const r = safeParseAnswerRequest({
        questionId: VALID_QUESTION_ID,
        userAnswer: 0,
        userId: null,
      })
      expect(r.success).toBe(true)
    })

    test('responseTimeMs >= 0', () => {
      const r = safeParseAnswerRequest({
        questionId: VALID_QUESTION_ID,
        userAnswer: -1,
        responseTimeMs: 5000,
      })
      expect(r.success).toBe(true)
    })

    test('responseTimeMs negativo rechazado', () => {
      const r = safeParseAnswerRequest({
        questionId: VALID_QUESTION_ID,
        userAnswer: 0,
        responseTimeMs: -1,
      })
      expect(r.success).toBe(false)
    })
  })

  describe('regression: caso reportado en logs Vercel', () => {
    test('blank skip desde TestLayoutV2 (questionId UUID + userAnswer:-1) ahora se acepta', () => {
      // Reproducción exacta del request body que aparecía en validation_error_logs
      // como "Datos inválidos" (3 ocurrencias en 48h con clientes Chrome 147 / Firefox 150)
      // antes del fix.
      const r = safeParseAnswerRequest({
        questionId: '27ad729b-9468-40d5-b764-52ce0e19540e',
        userAnswer: -1,
      })
      expect(r.success).toBe(true)
    })
  })
})
