/**
 * Tests para admin-check-push-status: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  checkPushStatusResponseSchema,
  checkPushStatusErrorSchema,
} from '@/lib/api/admin-check-push-status/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Check Push Status - Schemas', () => {
  describe('checkPushStatusResponseSchema', () => {
    it('should accept valid response', () => {
      const result = checkPushStatusResponseSchema.safeParse({
        success: true,
        message: 'Verificación de estado completada exitosamente',
        stats: {
          totalUsers: 100,
          activeUsers: 20,
          inactiveUsers: 30,
          expiredUsers: 5,
          neverConfigured: 45,
          details: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              email: 'test@example.com',
              name: 'Test User',
              status: 'active',
              statusLabel: '🟢 Activo',
              details: 'Push notifications habilitadas',
              created: '2026-01-01',
              lastUpdate: '2026-01-15'
            }
          ]
        },
        timestamp: '2026-01-01T00:00:00.000Z',
        summary: '20 activos de 100 usuarios totales'
      })
      expect(result.success).toBe(true)
    })

    it('should accept all user status types', () => {
      const statuses = ['active', 'inactive', 'test_user', 'invalid_subscription', 'never_configured'] as const
      for (const status of statuses) {
        const result = checkPushStatusResponseSchema.safeParse({
          success: true,
          message: 'OK',
          stats: {
            totalUsers: 1, activeUsers: 0, inactiveUsers: 0, expiredUsers: 0, neverConfigured: 0,
            details: [{
              id: '550e8400-e29b-41d4-a716-446655440000',
              email: 'test@example.com',
              name: 'Test',
              status,
              statusLabel: 'label',
              details: 'details',
              created: '2026-01-01',
              lastUpdate: 'Nunca'
            }]
          },
          timestamp: '2026-01-01T00:00:00.000Z',
          summary: 'test'
        })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid status', () => {
      const result = checkPushStatusResponseSchema.safeParse({
        success: true,
        message: 'OK',
        stats: {
          totalUsers: 1, activeUsers: 0, inactiveUsers: 0, expiredUsers: 0, neverConfigured: 0,
          details: [{
            id: '550e8400-e29b-41d4-a716-446655440000',
            email: 'test@example.com',
            name: 'Test',
            status: 'unknown_status',
            statusLabel: 'label',
            details: 'details',
            created: '2026-01-01',
            lastUpdate: 'Nunca'
          }]
        },
        timestamp: '2026-01-01T00:00:00.000Z',
        summary: 'test'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('checkPushStatusErrorSchema', () => {
    it('should accept valid error', () => {
      const result = checkPushStatusErrorSchema.safeParse({
        error: 'Error interno'
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Check Push Status - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should classify users by push status', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: (table: any) => {
            if (table === 'user_profiles') {
              return {
                orderBy: () => Promise.resolve([
                  { id: 'u1', email: 'active@test.com', fullName: 'Active', createdAt: '2026-01-01T00:00:00Z' },
                  { id: 'u2', email: 'inactive@test.com', fullName: 'Inactive', createdAt: '2026-01-01T00:00:00Z' },
                  { id: 'u3', email: 'never@test.com', fullName: 'Never', createdAt: '2026-01-01T00:00:00Z' }
                ])
              }
            }
            // userNotificationSettings
            return Promise.resolve([
              { userId: 'u1', pushEnabled: true, pushSubscription: { endpoint: 'https://push.example.com/sub1' }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-15T00:00:00Z' },
              { userId: 'u2', pushEnabled: false, pushSubscription: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-10T00:00:00Z' }
            ])
          }
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: 'user_profiles',
      userNotificationSettings: 'user_notification_settings'
    }))

    jest.doMock('drizzle-orm', () => ({
      desc: () => 'desc'
    }))

    const { checkAllPushStatus } = require('@/lib/api/admin-check-push-status/queries')
    const result = await checkAllPushStatus()

    expect(result.success).toBe(true)
    expect(result.stats.totalUsers).toBe(3)
    expect(result.stats.activeUsers).toBe(1)
    expect(result.stats.inactiveUsers).toBe(1)
    expect(result.stats.neverConfigured).toBe(1)
  })

  it('should handle empty users list', async () => {
    let callCount = 0
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => {
            callCount++
            if (callCount === 1) {
              // userProfiles query
              return { orderBy: () => Promise.resolve([]) }
            }
            // userNotificationSettings query
            return Promise.resolve([])
          }
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: 'user_profiles',
      userNotificationSettings: 'user_notification_settings'
    }))

    jest.doMock('drizzle-orm', () => ({
      desc: () => 'desc'
    }))

    const { checkAllPushStatus } = require('@/lib/api/admin-check-push-status/queries')
    const result = await checkAllPushStatus()

    expect(result.success).toBe(true)
    expect(result.stats.totalUsers).toBe(0)
  })
})
