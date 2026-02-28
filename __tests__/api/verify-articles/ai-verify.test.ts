/**
 * Tests para verify-articles/ai-verify (single question): schemas
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { aiVerifySingleParamsSchema } from '@/lib/api/verify-articles/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Verify Articles - AI Verify Single Schema', () => {
  describe('aiVerifySingleParamsSchema', () => {
    const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const validUuid2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'

    it('should accept valid with all fields', () => {
      const result = aiVerifySingleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        questionId: validUuid2,
        provider: 'openai',
      })
      expect(result.success).toBe(true)
    })

    it('should accept without provider (default openai)', () => {
      const result = aiVerifySingleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        questionId: validUuid2,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('openai')
      }
    })

    it('should accept provider claude', () => {
      const result = aiVerifySingleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        questionId: validUuid2,
        provider: 'claude',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('claude')
      }
    })

    it('should reject missing lawId', () => {
      const result = aiVerifySingleParamsSchema.safeParse({
        articleNumber: '15',
        questionId: validUuid2,
        provider: 'openai',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing questionId', () => {
      const result = aiVerifySingleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        provider: 'openai',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid provider google (only openai/claude allowed in single)', () => {
      const result = aiVerifySingleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        questionId: validUuid2,
        provider: 'google',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID lawId', () => {
      const result = aiVerifySingleParamsSchema.safeParse({
        lawId: 'not-a-uuid',
        articleNumber: '15',
        questionId: validUuid2,
        provider: 'openai',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID questionId', () => {
      const result = aiVerifySingleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        questionId: 'not-a-uuid',
        provider: 'openai',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing articleNumber', () => {
      const result = aiVerifySingleParamsSchema.safeParse({
        lawId: validUuid,
        questionId: validUuid2,
        provider: 'openai',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty articleNumber', () => {
      const result = aiVerifySingleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '',
        questionId: validUuid2,
        provider: 'openai',
      })
      expect(result.success).toBe(false)
    })
  })
})
