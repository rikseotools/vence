/**
 * Tests para admin-load-users-with-push: schemas, queries y route
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  loadUsersWithPushResponseSchema,
  loadUsersWithPushErrorSchema,
} from '@/lib/api/admin-load-users-with-push/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Load Users With Push - Schemas', () => {
  describe('loadUsersWithPushResponseSchema', () => {
    it('should accept valid response with users', () => {
      const result = loadUsersWithPushResponseSchema.safeParse({
        success: true,
        users: [{
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'test@example.com',
          fullName: 'Test User',
          createdAt: '2025-01-01T00:00:00Z',
          userNotificationSettings: {
            userId: '550e8400-e29b-41d4-a716-446655440000',
            pushEnabled: true,
            pushSubscription: { endpoint: 'https://...' },
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z'
          }
        }],
        stats: {
          totalUsers: 100,
          usersWithSettings: 50,
          usersWithPushEnabled: 10
        },
        message: '10 usuarios con push habilitado'
      })
      expect(result.success).toBe(true)
    })

    it('should accept response with empty users', () => {
      const result = loadUsersWithPushResponseSchema.safeParse({
        success: true,
        users: [],
        stats: { totalUsers: 0, usersWithSettings: 0, usersWithPushEnabled: 0 },
        message: 'No hay usuarios en el sistema'
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative stats', () => {
      const result = loadUsersWithPushResponseSchema.safeParse({
        success: true,
        users: [],
        stats: { totalUsers: -1, usersWithSettings: 0, usersWithPushEnabled: 0 },
        message: 'Test'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('loadUsersWithPushErrorSchema', () => {
    it('should accept valid error', () => {
      const result = loadUsersWithPushErrorSchema.safeParse({
        error: 'Error interno'
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Load Users With Push - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should filter users with push enabled and subscription', async () => {
    const users = [
      { id: 'u1', email: 'a@test.com', fullName: 'A', createdAt: '2025-01-01' },
      { id: 'u2', email: 'b@test.com', fullName: 'B', createdAt: '2025-01-02' },
      { id: 'u3', email: 'c@test.com', fullName: 'C', createdAt: '2025-01-03' },
    ]
    const settings = [
      { userId: 'u1', pushEnabled: true, pushSubscription: { endpoint: 'x' }, createdAt: '2025-01-01', updatedAt: '2025-01-01' },
      { userId: 'u2', pushEnabled: false, pushSubscription: null, createdAt: '2025-01-02', updatedAt: '2025-01-02' },
      { userId: 'u3', pushEnabled: true, pushSubscription: null, createdAt: '2025-01-03', updatedAt: '2025-01-03' },
    ]

    let callIndex = 0
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve(users)
            }),
            where: () => Promise.resolve(settings)
          })
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: { id: 'id', email: 'email', fullName: 'full_name', createdAt: 'created_at' },
      userNotificationSettings: { userId: 'user_id', pushEnabled: 'push_enabled', pushSubscription: 'push_subscription' }
    }))

    const { loadUsersWithPush } = require('@/lib/api/admin-load-users-with-push/queries')
    const result = await loadUsersWithPush()

    expect(result.success).toBe(true)
    expect(result.stats.totalUsers).toBe(3)
    expect(result.stats.usersWithSettings).toBe(3)
    // Only u1 has push_enabled=true AND push_subscription not null
    expect(result.stats.usersWithPushEnabled).toBe(1)
    expect(result.users[0].id).toBe('u1')
  })

  it('should return empty when no users exist', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([])
            })
          })
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: { id: 'id', email: 'email', fullName: 'full_name', createdAt: 'created_at' },
      userNotificationSettings: {}
    }))

    const { loadUsersWithPush } = require('@/lib/api/admin-load-users-with-push/queries')
    const result = await loadUsersWithPush()

    expect(result.success).toBe(true)
    expect(result.users).toEqual([])
    expect(result.stats.totalUsers).toBe(0)
  })
})
