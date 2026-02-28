/**
 * Tests para admin-send-test-notification: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  sendTestNotificationRequestSchema,
  sendTestNotificationResponseSchema,
} from '@/lib/api/admin-send-test-notification/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Send Test Notification - Schemas', () => {
  describe('sendTestNotificationRequestSchema', () => {
    it('should accept valid request', () => {
      const result = sendTestNotificationRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test notification',
        body: 'This is a test',
      })
      expect(result.success).toBe(true)
    })

    it('should accept request with optional fields', () => {
      const result = sendTestNotificationRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test',
        body: 'Body',
        category: 'motivation',
        data: { testSentBy: 'admin' },
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const result = sendTestNotificationRequestSchema.safeParse({
        userId: 'not-a-uuid',
        title: 'Test',
        body: 'Body',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty title', () => {
      const result = sendTestNotificationRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        title: '',
        body: 'Body',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing required fields', () => {
      expect(sendTestNotificationRequestSchema.safeParse({}).success).toBe(false)
      expect(sendTestNotificationRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
      }).success).toBe(false)
    })
  })

  describe('sendTestNotificationResponseSchema', () => {
    it('should accept success response', () => {
      const result = sendTestNotificationResponseSchema.safeParse({
        success: true,
        message: 'Notificación enviada exitosamente',
        details: {
          pushStatusCode: 201,
          userId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Test',
          category: 'motivation',
          timestamp: '2025-01-15T10:00:00Z',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should accept error response', () => {
      const result = sendTestNotificationResponseSchema.safeParse({
        success: false,
        error: 'Suscripción push expirada',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Send Test Notification - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getUserPushSettings should return null when not found', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      userNotificationSettings: { userId: 'user_id' },
      notificationEvents: {},
    }))

    const { getUserPushSettings } = require('@/lib/api/admin-send-test-notification/queries')
    const result = await getUserPushSettings('non-existent-user')
    expect(result).toBeNull()
  })

  it('getUserPushSettings should return settings when found', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                pushEnabled: true,
                pushSubscription: '{"endpoint":"https://test.com"}',
              }]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      userNotificationSettings: { userId: 'user_id' },
      notificationEvents: {},
    }))

    const { getUserPushSettings } = require('@/lib/api/admin-send-test-notification/queries')
    const result = await getUserPushSettings('user-123')
    expect(result).not.toBeNull()
    expect(result.pushEnabled).toBe(true)
  })

  it('logTestPushEvent should not throw on error', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        insert: () => ({
          values: () => { throw new Error('DB error') },
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      userNotificationSettings: {},
      notificationEvents: {},
    }))

    const { logTestPushEvent } = require('@/lib/api/admin-send-test-notification/queries')
    await logTestPushEvent({
      userId: 'user-123',
      category: 'test',
      pushSubscription: {},
      notificationData: { title: 'Test' },
    })
  })
})
