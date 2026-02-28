/**
 * Tests para debug/question/test: schema only (trivial scaffolding)
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

// Schema para validar el response
const questionTestResponseSchema = z.object({
  success: z.boolean(),
  test_query: z.array(z.object({
    id: z.string(),
    questionText: z.string(),
    questionSubtype: z.string(),
  })),
  specific_query: z.array(z.object({
    id: z.string(),
    questionText: z.string(),
    questionSubtype: z.string(),
  })),
  connection: z.literal('OK'),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Debug Question Test - Schemas', () => {
  it('should accept valid successful response', () => {
    const result = questionTestResponseSchema.safeParse({
      success: true,
      test_query: [
        { id: 'q1', questionText: 'Q1?', questionSubtype: 'series' },
      ],
      specific_query: [
        { id: '588c79ed-05fa-421a-8f32-23e4038b700b', questionText: 'Specific?', questionSubtype: 'spatial' },
      ],
      connection: 'OK',
    })
    expect(result.success).toBe(true)
  })

  it('should accept empty query arrays', () => {
    const result = questionTestResponseSchema.safeParse({
      success: true,
      test_query: [],
      specific_query: [],
      connection: 'OK',
    })
    expect(result.success).toBe(true)
  })

  it('should reject missing connection field', () => {
    const result = questionTestResponseSchema.safeParse({
      success: true,
      test_query: [],
      specific_query: [],
    })
    expect(result.success).toBe(false)
  })

  it('should reject connection value other than OK', () => {
    const result = questionTestResponseSchema.safeParse({
      success: true,
      test_query: [],
      specific_query: [],
      connection: 'ERROR',
    })
    expect(result.success).toBe(false)
  })
})
