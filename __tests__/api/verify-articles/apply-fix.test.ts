/**
 * Tests para verify-articles/apply-fix: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { applyFixParamsSchema } from '@/lib/api/verify-articles/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Verify Articles - Apply Fix Schema', () => {
  describe('applyFixParamsSchema', () => {
    it('should accept valid params with all fields', () => {
      const result = applyFixParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        newCorrectOption: 'B',
        newExplanation: 'La respuesta correcta es B segun el articulo 10.',
        verificationId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        appliedBy: 'admin',
      })
      expect(result.success).toBe(true)
    })

    it('should accept with only questionId (minimal)', () => {
      const result = applyFixParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      })
      expect(result.success).toBe(true)
    })

    it('should accept newCorrectOption A', () => {
      const result = applyFixParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        newCorrectOption: 'A',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.newCorrectOption).toBe('A')
      }
    })

    it('should accept newCorrectOption B', () => {
      const result = applyFixParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        newCorrectOption: 'B',
      })
      expect(result.success).toBe(true)
    })

    it('should accept newCorrectOption C', () => {
      const result = applyFixParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        newCorrectOption: 'C',
      })
      expect(result.success).toBe(true)
    })

    it('should accept newCorrectOption D', () => {
      const result = applyFixParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        newCorrectOption: 'D',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid option E', () => {
      const result = applyFixParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        newCorrectOption: 'E',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing questionId', () => {
      const result = applyFixParamsSchema.safeParse({
        newCorrectOption: 'A',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID questionId', () => {
      const result = applyFixParamsSchema.safeParse({
        questionId: 'invalid-id',
        newCorrectOption: 'A',
      })
      expect(result.success).toBe(false)
    })

    it('should default appliedBy to admin', () => {
      const result = applyFixParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.appliedBy).toBe('admin')
      }
    })

    it('should allow custom appliedBy', () => {
      const result = applyFixParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        appliedBy: 'superadmin',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.appliedBy).toBe('superadmin')
      }
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Verify Articles - Apply Fix Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getQuestionById should return question or null', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                questionText: 'Pregunta de test',
                optionA: 'Opcion A',
                optionB: 'Opcion B',
                optionC: 'Opcion C',
                optionD: 'Opcion D',
                correctOption: 0,
                explanation: 'Explicacion actual',
              }]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      questions: {
        id: 'id',
        questionText: 'question_text',
        optionA: 'option_a',
        optionB: 'option_b',
        optionC: 'option_c',
        optionD: 'option_d',
        correctOption: 'correct_option',
        explanation: 'explanation',
      },
    }))

    const { getQuestionById } = require('@/lib/api/verify-articles/queries')
    const result = await getQuestionById('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(result).not.toBeNull()
    expect(result.questionText).toBe('Pregunta de test')
    expect(result.correctOption).toBe(0)
  })

  it('updateQuestion should complete without error', async () => {
    let setCalled = false
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        update: () => ({
          set: (data: Record<string, unknown>) => {
            setCalled = true
            expect(data.correctOption).toBe(1)
            return {
              where: () => Promise.resolve(),
            }
          },
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      questions: { id: 'id', correctOption: 'correct_option', explanation: 'explanation' },
    }))

    const { updateQuestion } = require('@/lib/api/verify-articles/queries')
    await updateQuestion('a1b2c3d4-e5f6-7890-abcd-ef1234567890', {
      correctOption: 1,
      explanation: 'Nueva explicacion corregida',
    })
    expect(setCalled).toBe(true)
  })
})
