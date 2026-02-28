/**
 * Tests para admin-users-count: schemas, queries y route
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  usersCountResponseSchema,
} from '@/lib/api/admin-users-count/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Users Count - Schemas', () => {
  describe('usersCountResponseSchema', () => {
    it('should accept valid response', () => {
      const result = usersCountResponseSchema.safeParse({
        total: 100,
        subscribed: 85,
        unsubscribed: 15,
        subscriptionRate: 85.0,
      })
      expect(result.success).toBe(true)
    })

    it('should accept zero users', () => {
      const result = usersCountResponseSchema.safeParse({
        total: 0,
        subscribed: 0,
        unsubscribed: 0,
        subscriptionRate: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should accept decimal subscriptionRate', () => {
      const result = usersCountResponseSchema.safeParse({
        total: 3,
        subscribed: 2,
        unsubscribed: 1,
        subscriptionRate: 66.7,
      })
      expect(result.success).toBe(true)
    })

    it('should reject subscriptionRate over 100', () => {
      const result = usersCountResponseSchema.safeParse({
        total: 100,
        subscribed: 100,
        unsubscribed: 0,
        subscriptionRate: 101,
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative total', () => {
      const result = usersCountResponseSchema.safeParse({
        total: -1,
        subscribed: 0,
        unsubscribed: 0,
        subscriptionRate: 0,
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing fields', () => {
      const result = usersCountResponseSchema.safeParse({
        total: 100,
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-integer counts', () => {
      const result = usersCountResponseSchema.safeParse({
        total: 10.5,
        subscribed: 8,
        unsubscribed: 2,
        subscriptionRate: 80,
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Admin Users Count - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function setupMock(total: number, unsubscribed: number) {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            leftJoin: () => Promise.resolve([{ total, unsubscribed }]),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: { id: 'id' },
      emailPreferences: { userId: 'user_id', unsubscribedAll: 'unsubscribed_all' },
    }))
  }

  it('should calculate subscription rate correctly', async () => {
    setupMock(100, 20)
    const { getUsersCount } = require('@/lib/api/admin-users-count/queries')
    const result = await getUsersCount()

    expect(result.total).toBe(100)
    expect(result.unsubscribed).toBe(20)
    expect(result.subscribed).toBe(80)
    expect(result.subscriptionRate).toBe(80.0)
  })

  it('should handle zero users', async () => {
    setupMock(0, 0)
    const { getUsersCount } = require('@/lib/api/admin-users-count/queries')
    const result = await getUsersCount()

    expect(result.total).toBe(0)
    expect(result.subscriptionRate).toBe(0)
  })

  it('should handle all subscribed', async () => {
    setupMock(50, 0)
    const { getUsersCount } = require('@/lib/api/admin-users-count/queries')
    const result = await getUsersCount()

    expect(result.subscribed).toBe(50)
    expect(result.subscriptionRate).toBe(100)
  })
})

// ============================================
// ROUTE RESPONSE FORMAT
// ============================================

describe('Admin Users Count - Route response format', () => {
  it('should match schema for typical response', () => {
    const response = {
      total: 250,
      subscribed: 230,
      unsubscribed: 20,
      subscriptionRate: 92.0,
    }
    const parsed = usersCountResponseSchema.safeParse(response)
    expect(parsed.success).toBe(true)
  })
})
