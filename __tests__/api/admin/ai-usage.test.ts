/**
 * Tests para admin-ai-usage: schemas, queries y route
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  aiUsageQuerySchema,
  aiUsageResponseSchema,
  aiUsageErrorSchema,
} from '@/lib/api/admin-ai-usage/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin AI Usage - Schemas', () => {
  describe('aiUsageQuerySchema', () => {
    it('should accept valid params with defaults', () => {
      const result = aiUsageQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(30)
        expect(result.data.provider).toBeUndefined()
      }
    })

    it('should coerce string days to number', () => {
      const result = aiUsageQuerySchema.safeParse({ days: '60' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(60)
      }
    })

    it('should accept valid provider', () => {
      const result = aiUsageQuerySchema.safeParse({ provider: 'anthropic' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid provider', () => {
      const result = aiUsageQuerySchema.safeParse({ provider: 'deepseek' })
      expect(result.success).toBe(false)
    })

    it('should reject days > 365', () => {
      const result = aiUsageQuerySchema.safeParse({ days: 1000 })
      expect(result.success).toBe(false)
    })
  })

  describe('aiUsageResponseSchema', () => {
    it('should accept valid response', () => {
      const result = aiUsageResponseSchema.safeParse({
        success: true,
        period: {
          days: 30,
          from: '2025-01-01T00:00:00Z',
          to: '2025-01-31T00:00:00Z'
        },
        stats: [{
          provider: 'openai',
          total_requests: 100,
          total_input_tokens: 50000,
          total_output_tokens: 25000,
          total_tokens: 75000,
          total_questions_verified: 50,
          by_model: {
            'gpt-4o-mini': { requests: 100, tokens: 75000, estimated_cost_usd: 0.0281 }
          },
          by_feature: {
            'question_verification': { requests: 50, tokens: 37500 }
          },
          by_day: {
            '2025-01-15': { requests: 10, tokens: 7500 }
          },
          estimated_total_cost_usd: 0.0281
        }],
        total_records: 100
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty stats', () => {
      const result = aiUsageResponseSchema.safeParse({
        success: true,
        period: { days: 30, from: '2025-01-01', to: '2025-01-31' },
        stats: [],
        total_records: 0
      })
      expect(result.success).toBe(true)
    })
  })

  describe('aiUsageErrorSchema', () => {
    it('should accept error response', () => {
      const result = aiUsageErrorSchema.safeParse({
        success: false,
        error: 'Error message'
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin AI Usage - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should aggregate usage by provider and calculate costs', async () => {
    const mockUsage = [
      {
        id: '1', provider: 'openai', model: 'gpt-4o-mini',
        inputTokens: 1000, outputTokens: 500, totalTokens: 1500,
        feature: 'question_verification', questionsCount: 5,
        createdAt: '2025-01-15T10:00:00Z'
      },
      {
        id: '2', provider: 'openai', model: 'gpt-4o-mini',
        inputTokens: 2000, outputTokens: 1000, totalTokens: 3000,
        feature: 'explanation_generation', questionsCount: 3,
        createdAt: '2025-01-16T10:00:00Z'
      },
      {
        id: '3', provider: 'anthropic', model: 'claude-3-haiku-20240307',
        inputTokens: 500, outputTokens: 200, totalTokens: 700,
        feature: 'question_verification', questionsCount: 2,
        createdAt: '2025-01-15T11:00:00Z'
      },
    ]

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockUsage)
            })
          })
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      aiApiUsage: { provider: 'provider', createdAt: 'created_at' }
    }))

    const { getAiUsageStats } = require('@/lib/api/admin-ai-usage/queries')
    const result = await getAiUsageStats(30)

    expect(result.success).toBe(true)
    expect(result.stats.length).toBe(2) // openai + anthropic
    expect(result.total_records).toBe(3)

    const openaiStats = result.stats.find((s: any) => s.provider === 'openai')
    expect(openaiStats).toBeDefined()
    expect(openaiStats.total_requests).toBe(2)
    expect(openaiStats.total_tokens).toBe(4500)
    expect(openaiStats.total_questions_verified).toBe(8)
    expect(openaiStats.by_model['gpt-4o-mini'].requests).toBe(2)
    expect(openaiStats.by_feature['question_verification'].requests).toBe(1)
    expect(openaiStats.by_feature['explanation_generation'].requests).toBe(1)

    // Cost calculation: gpt-4o-mini 4500 tokens * 50% input * 0.15/1M + 50% output * 0.60/1M
    expect(openaiStats.estimated_total_cost_usd).toBeGreaterThan(0)
  })

  it('should handle no usage data', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([])
            })
          })
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      aiApiUsage: { provider: 'provider', createdAt: 'created_at' }
    }))

    const { getAiUsageStats } = require('@/lib/api/admin-ai-usage/queries')
    const result = await getAiUsageStats(30)

    expect(result.success).toBe(true)
    expect(result.stats).toEqual([])
    expect(result.total_records).toBe(0)
  })
})
