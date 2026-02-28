/**
 * Tests para verify-articles/discard: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { discardParamsSchema } from '@/lib/api/verify-articles/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Verify Articles - Discard Schema', () => {
  describe('discardParamsSchema', () => {
    it('should accept valid params with discarded=true', () => {
      const result = discardParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        discarded: true,
      })
      expect(result.success).toBe(true)
    })

    it('should accept valid params with discarded=false', () => {
      const result = discardParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        discarded: false,
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing questionId', () => {
      const result = discardParamsSchema.safeParse({
        discarded: true,
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID questionId', () => {
      const result = discardParamsSchema.safeParse({
        questionId: 'not-a-uuid',
        discarded: true,
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing discarded field', () => {
      const result = discardParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-boolean discarded', () => {
      const result = discardParamsSchema.safeParse({
        questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        discarded: 'yes',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Verify Articles - Discard Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('updateVerificationDiscard should return array', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([
                { questionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', discarded: true, discardedAt: '2026-01-01T00:00:00Z' },
              ]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      aiVerificationResults: { questionId: 'question_id', discarded: 'discarded', discardedAt: 'discarded_at' },
    }))

    const { updateVerificationDiscard } = require('@/lib/api/verify-articles/queries')
    const result = await updateVerificationDiscard('a1b2c3d4-e5f6-7890-abcd-ef1234567890', true)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
    expect(result[0].discarded).toBe(true)
  })
})
