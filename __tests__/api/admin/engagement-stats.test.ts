/**
 * Tests para admin-engagement-stats: schemas, queries y route
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  engagementStatsQuerySchema,
  engagementStatsResponseSchema,
} from '@/lib/api/admin-engagement-stats/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Engagement Stats - Schemas', () => {
  describe('engagementStatsQuerySchema', () => {
    it('should accept valid days param', () => {
      const result = engagementStatsQuerySchema.safeParse({ days: 30 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.days).toBe(30)
    })

    it('should default to 30 days', () => {
      const result = engagementStatsQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.days).toBe(30)
    })

    it('should coerce string to number', () => {
      const result = engagementStatsQuerySchema.safeParse({ days: '7' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.days).toBe(7)
    })

    it('should reject days < 1', () => {
      const result = engagementStatsQuerySchema.safeParse({ days: 0 })
      expect(result.success).toBe(false)
    })

    it('should reject days > 365', () => {
      const result = engagementStatsQuerySchema.safeParse({ days: 500 })
      expect(result.success).toBe(false)
    })

    it('should accept days = 1', () => {
      const result = engagementStatsQuerySchema.safeParse({ days: 1 })
      expect(result.success).toBe(true)
    })

    it('should accept days = 365', () => {
      const result = engagementStatsQuerySchema.safeParse({ days: 365 })
      expect(result.success).toBe(true)
    })
  })

  describe('engagementStatsResponseSchema', () => {
    it('should accept valid response', () => {
      const result = engagementStatsResponseSchema.safeParse({
        activeUsers: 50,
        totalUsers: 200,
        mauPercentage: 25,
      })
      expect(result.success).toBe(true)
    })

    it('should accept zero users', () => {
      const result = engagementStatsResponseSchema.safeParse({
        activeUsers: 0,
        totalUsers: 0,
        mauPercentage: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should accept 100% MAU', () => {
      const result = engagementStatsResponseSchema.safeParse({
        activeUsers: 100,
        totalUsers: 100,
        mauPercentage: 100,
      })
      expect(result.success).toBe(true)
    })

    it('should reject mauPercentage over 100', () => {
      const result = engagementStatsResponseSchema.safeParse({
        activeUsers: 100,
        totalUsers: 50,
        mauPercentage: 200,
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative activeUsers', () => {
      const result = engagementStatsResponseSchema.safeParse({
        activeUsers: -1,
        totalUsers: 100,
        mauPercentage: 0,
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing fields', () => {
      const result = engagementStatsResponseSchema.safeParse({
        activeUsers: 50,
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Admin Engagement Stats - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function setupMock(activeCount: number, totalCount: number) {
    let callIndex = 0
    const results = [
      [{ count: activeCount }],  // tests query (has .where)
      [{ count: totalCount }],   // userProfiles query (no .where)
    ]

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => {
            const idx = callIndex++
            // tests query has .where, userProfiles doesn't
            if (idx === 0) {
              return { where: () => Promise.resolve(results[0]) }
            }
            return Promise.resolve(results[1])
          },
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      tests: { userId: 'user_id', isCompleted: 'is_completed', completedAt: 'completed_at' },
      userProfiles: { id: 'id' },
    }))
  }

  it('should calculate MAU percentage correctly', async () => {
    setupMock(30, 100)
    const { getEngagementStats } = require('@/lib/api/admin-engagement-stats/queries')
    const result = await getEngagementStats(30)

    expect(result.activeUsers).toBe(30)
    expect(result.totalUsers).toBe(100)
    expect(result.mauPercentage).toBe(30)
  })

  it('should handle zero total users', async () => {
    setupMock(0, 0)
    const { getEngagementStats } = require('@/lib/api/admin-engagement-stats/queries')
    const result = await getEngagementStats(30)

    expect(result.mauPercentage).toBe(0)
  })
})

// ============================================
// ROUTE RESPONSE FORMAT
// ============================================

describe('Admin Engagement Stats - Route response format', () => {
  it('should match schema for typical response', () => {
    const response = {
      activeUsers: 45,
      totalUsers: 300,
      mauPercentage: 15,
    }
    const parsed = engagementStatsResponseSchema.safeParse(response)
    expect(parsed.success).toBe(true)
  })
})
