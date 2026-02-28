/**
 * Tests para admin-ai-config/test: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  testAiConfigRequestSchema,
} from '@/lib/api/admin-ai-config/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin AI Config Test - Schemas', () => {
  describe('testAiConfigRequestSchema', () => {
    it('should accept valid test request', () => {
      const result = testAiConfigRequestSchema.safeParse({
        provider: 'openai',
        model: 'gpt-4o-mini',
        testAllModels: false,
      })
      expect(result.success).toBe(true)
    })

    it('should accept request with only provider', () => {
      const result = testAiConfigRequestSchema.safeParse({
        provider: 'anthropic',
      })
      expect(result.success).toBe(true)
    })

    it('should accept request with apiKey', () => {
      const result = testAiConfigRequestSchema.safeParse({
        provider: 'google',
        apiKey: 'AIza-test-key',
      })
      expect(result.success).toBe(true)
    })

    it('should accept testAllModels flag', () => {
      const result = testAiConfigRequestSchema.safeParse({
        provider: 'openai',
        testAllModels: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.testAllModels).toBe(true)
      }
    })

    it('should reject missing provider', () => {
      const result = testAiConfigRequestSchema.safeParse({
        model: 'gpt-4o-mini',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty provider', () => {
      const result = testAiConfigRequestSchema.safeParse({
        provider: '',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin AI Config Test - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('updateVerificationStatus should call update', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    })

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        update: mockUpdate,
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      aiApiConfig: { provider: 'provider' },
    }))

    const { updateVerificationStatus } = require('@/lib/api/admin-ai-config/queries')
    await updateVerificationStatus('openai', 'valid', null)

    expect(mockUpdate).toHaveBeenCalled()
  })
})
