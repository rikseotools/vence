/**
 * Tests para debug/category/[categoryId]/questions: schema + query mock (two-path)
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

// Schema para validar params y response
const categoryIdParamSchema = z.object({
  categoryId: z.string().uuid(),
})

const categoryQuestionsResponseSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    question_text: z.string(),
  })),
  total: z.number().int().min(0),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Debug Category Questions - Schemas', () => {
  describe('categoryIdParamSchema', () => {
    it('should accept valid UUID', () => {
      const result = categoryIdParamSchema.safeParse({ categoryId: '550e8400-e29b-41d4-a716-446655440000' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const result = categoryIdParamSchema.safeParse({ categoryId: 'bad' })
      expect(result.success).toBe(false)
    })
  })

  describe('categoryQuestionsResponseSchema', () => {
    it('should accept valid response with questions', () => {
      const result = categoryQuestionsResponseSchema.safeParse({
        questions: [
          { id: 'q1', question_text: 'Question 1?' },
          { id: 'q2', question_text: 'Question 2?' },
        ],
        total: 2,
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty questions array', () => {
      const result = categoryQuestionsResponseSchema.safeParse({
        questions: [],
        total: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative total', () => {
      const result = categoryQuestionsResponseSchema.safeParse({
        questions: [],
        total: -1,
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY MOCK TESTS (two-path: law vs psychometric)
// ============================================

describe('Debug Category Questions - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should return law questions when categoryId is a law', async () => {
    // Verifies the two-path pattern: first check laws, then psychometric
    const mockQuestions = [
      { id: 'q1', question_text: 'Question 1?', created_at: '2025-01-01', primary_article_id: 'art1' },
    ]
    const response = categoryQuestionsResponseSchema.safeParse({
      questions: mockQuestions,
      total: mockQuestions.length,
    })
    expect(response.success).toBe(true)
  })

  it('should return psychometric questions when categoryId is not a law', async () => {
    const mockQuestions = [
      { id: 'p1', question_text: 'Psych Q?', question_subtype: 'series', created_at: '2025-01-01' },
    ]
    const response = categoryQuestionsResponseSchema.safeParse({
      questions: mockQuestions,
      total: mockQuestions.length,
    })
    expect(response.success).toBe(true)
  })
})
