/**
 * Tests para admin-refresh-subscriptions: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  refreshSubscriptionsResponseSchema,
  refreshSubscriptionsErrorSchema,
} from '@/lib/api/admin-refresh-subscriptions/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Refresh Subscriptions - Schemas', () => {
  describe('refreshSubscriptionsResponseSchema', () => {
    it('should accept valid response', () => {
      const result = refreshSubscriptionsResponseSchema.safeParse({
        success: true,
        message: 'Verificación completada. 5 válidas, 2 expiradas, 2 renovadas.',
        results: {
          total: 7,
          valid: 5,
          expired: 2,
          renewed: 2,
          errors: []
        }
      })
      expect(result.success).toBe(true)
    })

    it('should accept response with errors', () => {
      const result = refreshSubscriptionsResponseSchema.safeParse({
        success: true,
        message: 'Verificación completada.',
        results: {
          total: 3,
          valid: 1,
          expired: 1,
          renewed: 0,
          errors: [
            { user_id: '550e8400-e29b-41d4-a716-446655440000', error: 'Push error 403: Forbidden' }
          ]
        }
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty results', () => {
      const result = refreshSubscriptionsResponseSchema.safeParse({
        success: true,
        message: 'No hay suscripciones para verificar',
        results: {
          total: 0,
          valid: 0,
          expired: 0,
          renewed: 0,
          errors: []
        }
      })
      expect(result.success).toBe(true)
    })
  })

  describe('refreshSubscriptionsErrorSchema', () => {
    it('should accept valid error', () => {
      const result = refreshSubscriptionsErrorSchema.safeParse({
        error: 'Configuración VAPID incompleta'
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Refresh Subscriptions - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should return active subscriptions', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([
              { userId: 'u1', pushSubscription: { endpoint: 'https://push.example.com/1' } },
              { userId: 'u2', pushSubscription: { endpoint: 'https://push.example.com/2' } },
              { userId: 'u3', pushSubscription: null }
            ])
          })
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userNotificationSettings: { userId: 'user_id', pushEnabled: 'push_enabled', pushSubscription: 'push_subscription' },
      notificationEvents: {}
    }))

    jest.doMock('drizzle-orm', () => ({
      eq: () => 'eq',
      isNotNull: () => 'isNotNull'
    }))

    const { getActiveSubscriptions } = require('@/lib/api/admin-refresh-subscriptions/queries')
    const result = await getActiveSubscriptions()

    // Should filter out null subscriptions
    expect(result.length).toBe(2)
    expect(result[0].userId).toBe('u1')
    expect(result[1].userId).toBe('u2')
  })

  it('should mark subscription as expired', async () => {
    const updateMock = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined)
      })
    })
    const insertMock = jest.fn().mockReturnValue({
      values: jest.fn().mockResolvedValue(undefined)
    })

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        update: updateMock,
        insert: insertMock
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userNotificationSettings: { userId: 'user_id' },
      notificationEvents: {}
    }))

    jest.doMock('drizzle-orm', () => ({
      eq: () => 'eq'
    }))

    const { markSubscriptionExpired } = require('@/lib/api/admin-refresh-subscriptions/queries')
    await markSubscriptionExpired('u1', 410)

    expect(updateMock).toHaveBeenCalled()
    expect(insertMock).toHaveBeenCalled()
  })
})
