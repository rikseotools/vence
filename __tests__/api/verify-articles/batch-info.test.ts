/**
 * Tests para verify-articles/batch-info: schemas y ai-helpers constants
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { batchInfoParamsSchema } from '@/lib/api/verify-articles/schemas'
import { MODEL_BATCH_LIMITS, getSafeBatchSize, getMaxOutputTokens } from '@/lib/api/verify-articles/ai-helpers'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Verify Articles - Batch Info Schema', () => {
  describe('batchInfoParamsSchema', () => {
    it('should accept valid params with lawId and articleNumbers', () => {
      const result = batchInfoParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        articleNumbers: ['1', '2'],
      })
      expect(result.success).toBe(true)
    })

    it('should accept valid params with model', () => {
      const result = batchInfoParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        articleNumbers: ['10', '11', '12'],
        model: 'gpt-4o-mini',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model).toBe('gpt-4o-mini')
      }
    })

    it('should accept single articleNumber in array', () => {
      const result = batchInfoParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        articleNumbers: ['1'],
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing lawId', () => {
      const result = batchInfoParamsSchema.safeParse({
        articleNumbers: ['1', '2'],
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID lawId', () => {
      const result = batchInfoParamsSchema.safeParse({
        lawId: 'not-a-uuid',
        articleNumbers: ['1'],
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty articleNumbers array', () => {
      const result = batchInfoParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        articleNumbers: [],
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing articleNumbers', () => {
      const result = batchInfoParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      })
      expect(result.success).toBe(false)
    })

    it('should reject articleNumbers with empty strings', () => {
      const result = batchInfoParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        articleNumbers: [''],
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// AI-HELPERS CONSTANTS TESTS
// ============================================

describe('Verify Articles - AI Helpers Constants', () => {
  describe('MODEL_BATCH_LIMITS', () => {
    it('should be a Record with expected model keys', () => {
      expect(typeof MODEL_BATCH_LIMITS).toBe('object')
      expect('gpt-4o-mini' in MODEL_BATCH_LIMITS).toBe(true)
      expect('gpt-4o' in MODEL_BATCH_LIMITS).toBe(true)
      expect('claude-3-haiku-20240307' in MODEL_BATCH_LIMITS).toBe(true)
      expect('gemini-1.5-flash' in MODEL_BATCH_LIMITS).toBe(true)
    })

    it('should have numeric values for all entries', () => {
      for (const [key, value] of Object.entries(MODEL_BATCH_LIMITS)) {
        expect(typeof value).toBe('number')
        expect(value).toBeGreaterThan(0)
      }
    })

    it('gpt-4o-mini should have limit of 18', () => {
      expect(MODEL_BATCH_LIMITS['gpt-4o-mini']).toBe(18)
    })

    it('claude-3-haiku should have limit of 4', () => {
      expect(MODEL_BATCH_LIMITS['claude-3-haiku-20240307']).toBe(4)
    })
  })

  describe('getSafeBatchSize', () => {
    it('should return known limit for gpt-4o-mini', () => {
      expect(getSafeBatchSize('gpt-4o-mini')).toBe(18)
    })

    it('should return default 4 for unknown model', () => {
      expect(getSafeBatchSize('unknown-model-xyz')).toBe(4)
    })
  })

  describe('getMaxOutputTokens', () => {
    it('should return known limit for gpt-4o-mini', () => {
      expect(getMaxOutputTokens('gpt-4o-mini')).toBe(16384)
    })

    it('should return default 4096 for unknown model', () => {
      expect(getMaxOutputTokens('unknown-model-xyz')).toBe(4096)
    })
  })
})
