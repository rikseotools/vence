/**
 * Tests para admin-funnel-users: schemas, queries y route
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  funnelUsersQuerySchema,
  funnelUsersResponseSchema,
  funnelUsersErrorSchema,
  funnelStages,
} from '@/lib/api/admin-funnel-users/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Funnel Users - Schemas', () => {
  describe('funnelUsersQuerySchema', () => {
    it('should accept valid params with defaults', () => {
      const result = funnelUsersQuerySchema.safeParse({ stage: 'registrations' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(7)
        expect(result.data.limit).toBe(50)
      }
    })

    it('should accept all valid stages', () => {
      for (const stage of funnelStages) {
        const result = funnelUsersQuerySchema.safeParse({ stage })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid stage', () => {
      const result = funnelUsersQuerySchema.safeParse({ stage: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('should reject missing stage', () => {
      const result = funnelUsersQuerySchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should coerce string days to number', () => {
      const result = funnelUsersQuerySchema.safeParse({ stage: 'paid', days: '14' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.days).toBe(14)
      }
    })

    it('should reject limit > 500', () => {
      const result = funnelUsersQuerySchema.safeParse({ stage: 'paid', limit: 1000 })
      expect(result.success).toBe(false)
    })
  })

  describe('funnelUsersResponseSchema', () => {
    it('should accept valid response for registrations', () => {
      const result = funnelUsersResponseSchema.safeParse({
        stage: 'registrations',
        count: 2,
        users: [
          { id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@test.com', fullName: 'A', planType: 'free', registrationSource: 'organic', createdAt: '2025-01-01' },
          { id: '550e8400-e29b-41d4-a716-446655440001', email: 'b@test.com', fullName: 'B', planType: 'premium', registrationSource: 'google', createdAt: '2025-01-02' }
        ],
        period: { days: 7, from: '2025-01-01T00:00:00Z' }
      })
      expect(result.success).toBe(true)
    })

    it('should accept valid response for event-based stage', () => {
      const result = funnelUsersResponseSchema.safeParse({
        stage: 'paid',
        count: 1,
        users: [
          { id: '550e8400-e29b-41d4-a716-446655440000', email: 'a@test.com', eventAt: '2025-01-15', eventType: 'payment_completed' }
        ],
        period: { days: 30, from: '2024-12-15' }
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty users', () => {
      const result = funnelUsersResponseSchema.safeParse({
        stage: 'hit_limit',
        count: 0,
        users: [],
        period: { days: 7, from: '2025-01-01' }
      })
      expect(result.success).toBe(true)
    })
  })

  describe('funnelUsersErrorSchema', () => {
    it('should accept error', () => {
      const result = funnelUsersErrorSchema.safeParse({ error: 'stage parameter required' })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Funnel Users - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should return users for registrations stage', async () => {
    const mockUsers = [
      { id: 'u1', email: 'a@test.com', fullName: 'A', planType: 'free', registrationSource: 'organic', createdAt: '2025-01-20' },
    ]

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(mockUsers)
              })
            })
          })
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: {
        id: 'id', email: 'email', fullName: 'full_name', planType: 'plan_type',
        registrationSource: 'registration_source', createdAt: 'created_at',
        firstTestCompletedAt: 'first_test_completed_at'
      },
      conversionEvents: { userId: 'user_id', eventType: 'event_type', createdAt: 'created_at' }
    }))

    const { getFunnelUsers } = require('@/lib/api/admin-funnel-users/queries')
    const result = await getFunnelUsers('registrations', 7, 50)

    expect(result.stage).toBe('registrations')
    expect(result.count).toBe(1)
    expect(result.users[0].email).toBe('a@test.com')
  })

  it('should return users for event-based stage (hit_limit)', async () => {
    // Use future dates that will pass the cutoff filter
    const recentDate1 = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    const recentDate2 = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()

    const mockEvents = [
      { userId: 'u1', eventType: 'limit_reached', createdAt: recentDate1 },
      { userId: 'u2', eventType: 'limit_reached', createdAt: recentDate2 },
    ]
    const mockProfiles = [
      { id: 'u1', email: 'a@test.com', fullName: 'A', planType: 'free', registrationSource: 'organic', createdAt: '2025-01-01' },
      { id: 'u2', email: 'b@test.com', fullName: 'B', planType: 'free', registrationSource: 'google', createdAt: '2025-01-02' },
    ]

    let queryCount = 0
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => {
            queryCount++
            if (queryCount === 1) {
              // conversionEvents query
              return {
                where: () => ({
                  orderBy: () => Promise.resolve(mockEvents)
                })
              }
            }
            // userProfiles query
            return {
              where: () => Promise.resolve(mockProfiles)
            }
          }
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: {
        id: 'id', email: 'email', fullName: 'full_name', planType: 'plan_type',
        registrationSource: 'registration_source', createdAt: 'created_at',
        firstTestCompletedAt: 'first_test_completed_at'
      },
      conversionEvents: { userId: 'user_id', eventType: 'event_type', createdAt: 'created_at' }
    }))

    const { getFunnelUsers } = require('@/lib/api/admin-funnel-users/queries')
    const result = await getFunnelUsers('hit_limit', 30, 50)

    expect(result.stage).toBe('hit_limit')
    expect(result.count).toBe(2)
    expect(result.users[0].eventType).toBe('limit_reached')
  })
})
