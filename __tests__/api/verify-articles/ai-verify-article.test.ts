/**
 * Tests para verify-articles/ai-verify-article (batch): schemas y ai-helpers
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { aiVerifyArticleParamsSchema } from '@/lib/api/verify-articles/schemas'
import { getMaxOutputTokens, getSafeBatchSize, normalizeProvider, calculateIsOk } from '@/lib/api/verify-articles/ai-helpers'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Verify Articles - AI Verify Article Schema', () => {
  describe('aiVerifyArticleParamsSchema', () => {
    const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const validUuid2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
    const validUuid3 = 'c3d4e5f6-a7b8-9012-cdef-123456789012'

    it('should accept valid with all fields', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        provider: 'openai',
        model: 'gpt-4o-mini',
        questionIds: [validUuid2, validUuid3],
      })
      expect(result.success).toBe(true)
    })

    it('should accept minimal (lawId + articleNumber)', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('openai')
      }
    })

    it('should accept with provider anthropic', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        provider: 'anthropic',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('anthropic')
      }
    })

    it('should accept with provider google', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        provider: 'google',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('google')
      }
    })

    it('should accept with provider claude', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        provider: 'claude',
      })
      expect(result.success).toBe(true)
    })

    it('should accept with questionIds array', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        questionIds: [validUuid2],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.questionIds).toHaveLength(1)
      }
    })

    it('should accept with questionIds null', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        questionIds: null,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.questionIds).toBeNull()
      }
    })

    it('should reject missing lawId', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        articleNumber: '15',
        provider: 'openai',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing articleNumber', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        provider: 'openai',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID questionIds', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        questionIds: ['not-a-uuid'],
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID lawId', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: 'not-a-uuid',
        articleNumber: '15',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid provider', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
        provider: 'deepseek',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty articleNumber', () => {
      const result = aiVerifyArticleParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// AI HELPERS TESTS
// ============================================

describe('Verify Articles - AI Helpers', () => {
  describe('normalizeProvider', () => {
    it('should normalize claude to anthropic', () => {
      expect(normalizeProvider('claude')).toBe('anthropic')
    })

    it('should keep openai as-is', () => {
      expect(normalizeProvider('openai')).toBe('openai')
    })

    it('should keep anthropic as-is', () => {
      expect(normalizeProvider('anthropic')).toBe('anthropic')
    })

    it('should keep google as-is', () => {
      expect(normalizeProvider('google')).toBe('google')
    })
  })

  describe('getMaxOutputTokens', () => {
    it('should return a number > 0 for gpt-4o-mini', () => {
      const tokens = getMaxOutputTokens('gpt-4o-mini')
      expect(typeof tokens).toBe('number')
      expect(tokens).toBeGreaterThan(0)
    })

    it('should return 16384 for gpt-4o-mini', () => {
      expect(getMaxOutputTokens('gpt-4o-mini')).toBe(16384)
    })

    it('should return 4096 for claude-3-haiku-20240307', () => {
      expect(getMaxOutputTokens('claude-3-haiku-20240307')).toBe(4096)
    })

    it('should return default 4096 for unknown models', () => {
      expect(getMaxOutputTokens('unknown-model')).toBe(4096)
    })
  })

  describe('getSafeBatchSize', () => {
    it('should return a number > 0 for gpt-4o-mini', () => {
      const size = getSafeBatchSize('gpt-4o-mini')
      expect(typeof size).toBe('number')
      expect(size).toBeGreaterThan(0)
    })

    it('should return 18 for gpt-4o-mini', () => {
      expect(getSafeBatchSize('gpt-4o-mini')).toBe(18)
    })

    it('should return 4 for claude-3-haiku-20240307', () => {
      expect(getSafeBatchSize('claude-3-haiku-20240307')).toBe(4)
    })

    it('should return default 4 for unknown models', () => {
      expect(getSafeBatchSize('unknown-model')).toBe(4)
    })
  })

  describe('calculateIsOk', () => {
    it('should return false for null summary', () => {
      expect(calculateIsOk(null)).toBe(false)
    })

    it('should return true for no_consolidated_text', () => {
      expect(calculateIsOk({ no_consolidated_text: true })).toBe(true)
    })

    it('should return false when boe_count is 0', () => {
      expect(calculateIsOk({ boe_count: 0 })).toBe(false)
    })

    it('should return true when all counts are zero', () => {
      expect(calculateIsOk({
        boe_count: 10,
        title_mismatch: 0,
        content_mismatch: 0,
        extra_in_db: 0,
        missing_in_db: 0,
      })).toBe(true)
    })

    it('should return false when title_mismatch > 0', () => {
      expect(calculateIsOk({
        boe_count: 10,
        title_mismatch: 2,
        content_mismatch: 0,
        extra_in_db: 0,
        missing_in_db: 0,
      })).toBe(false)
    })

    it('should return false when missing_in_db > 0', () => {
      expect(calculateIsOk({
        boe_count: 10,
        title_mismatch: 0,
        content_mismatch: 0,
        extra_in_db: 0,
        missing_in_db: 3,
      })).toBe(false)
    })

    it('should return false for message about no articles found', () => {
      expect(calculateIsOk({
        message: 'No se encontraron artículos en la ley',
      })).toBe(false)
    })
  })
})
