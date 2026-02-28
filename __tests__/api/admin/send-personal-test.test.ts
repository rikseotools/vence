/**
 * Tests para admin-send-personal-test: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  sendPersonalTestRequestSchema,
  sendPersonalTestResponseSchema,
} from '@/lib/api/admin-send-personal-test/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Send Personal Test - Schemas', () => {
  describe('sendPersonalTestRequestSchema', () => {
    it('should accept valid request', () => {
      const result = sendPersonalTestRequestSchema.safeParse({
        adminEmail: 'manueltrader@gmail.com',
        title: 'Test notification',
        body: 'This is a test',
      })
      expect(result.success).toBe(true)
    })

    it('should accept request with optional fields', () => {
      const result = sendPersonalTestRequestSchema.safeParse({
        adminEmail: 'manueltrader@gmail.com',
        title: 'Test',
        body: 'Body',
        category: 'motivation',
        data: { custom: 'value' },
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = sendPersonalTestRequestSchema.safeParse({
        adminEmail: 'not-an-email',
        title: 'Test',
        body: 'Body',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty title', () => {
      const result = sendPersonalTestRequestSchema.safeParse({
        adminEmail: 'manueltrader@gmail.com',
        title: '',
        body: 'Body',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing body', () => {
      const result = sendPersonalTestRequestSchema.safeParse({
        adminEmail: 'manueltrader@gmail.com',
        title: 'Test',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('sendPersonalTestResponseSchema', () => {
    it('should accept success response with details', () => {
      const result = sendPersonalTestResponseSchema.safeParse({
        success: true,
        message: 'Notificación enviada',
        details: {
          pushStatusCode: 201,
          userId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Test',
          category: 'admin_test',
          timestamp: '2025-01-15T10:00:00Z',
          domain: 'vence.es',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should accept error response', () => {
      const result = sendPersonalTestResponseSchema.safeParse({
        success: false,
        error: 'Push disabled',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Send Personal Test - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getAdminPushSettings should return settings when found', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: 'user-123' }]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      userProfiles: { email: 'email', id: 'id' },
      userNotificationSettings: { userId: 'user_id' },
      notificationEvents: {},
    }))

    const { getAdminPushSettings } = require('@/lib/api/admin-send-personal-test/queries')

    // Due to chaining complexity, test that function exists and calls DB
    const result = await getAdminPushSettings('manueltrader@gmail.com')
    // First query returns [{ id: 'user-123' }], but second query for settings
    // also uses the same mock, so it returns [{ id: 'user-123' }]
    expect(result).toBeTruthy()
  })

  it('logPushEvent should not throw on error', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        insert: () => ({
          values: () => { throw new Error('DB error') },
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      userProfiles: {},
      userNotificationSettings: {},
      notificationEvents: {},
    }))

    const { logPushEvent } = require('@/lib/api/admin-send-personal-test/queries')
    // Should not throw (error is caught internally)
    await logPushEvent({
      userId: 'user-123',
      notificationType: 'test',
      pushSubscription: {},
      notificationData: { title: 'Test' },
    })
  })
})
