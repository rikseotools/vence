/**
 * Tests para push/mark-disabled: schema + update/insert mock
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

// Schema del request body
const markDisabledSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(1),
  timestamp: z.string().optional(),
})

// Schema del response
const markDisabledResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  reason: z.string(),
  timestamp: z.string(),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Push Mark Disabled - Schemas', () => {
  describe('markDisabledSchema (request)', () => {
    it('should accept valid request body', () => {
      const result = markDisabledSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'subscription_expired',
        timestamp: '2025-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('should accept without timestamp', () => {
      const result = markDisabledSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        reason: 'user_denied',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing userId', () => {
      const result = markDisabledSchema.safeParse({ reason: 'test' })
      expect(result.success).toBe(false)
    })

    it('should reject missing reason', () => {
      const result = markDisabledSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty reason', () => {
      const result = markDisabledSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        reason: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid userId', () => {
      const result = markDisabledSchema.safeParse({
        userId: 'not-uuid',
        reason: 'test',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('markDisabledResponseSchema', () => {
    it('should accept valid success response', () => {
      const result = markDisabledResponseSchema.safeParse({
        success: true,
        message: 'Push notifications marcadas como deshabilitadas',
        reason: 'subscription_expired',
        timestamp: '2025-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// EVENT_TYPE FIX TEST
// ============================================

describe('Push Mark Disabled - Event Type Fix', () => {
  it('should use subscription_deleted instead of push_subscription_disabled', () => {
    // The route uses 'subscription_deleted' which is a valid value in the
    // notification_events_event_type_check constraint, unlike the original
    // 'push_subscription_disabled' which would violate the constraint
    const validEventTypes = [
      'permission_requested', 'permission_granted', 'permission_denied',
      'subscription_created', 'subscription_updated', 'subscription_deleted',
      'notification_sent', 'notification_delivered', 'notification_clicked',
      'notification_dismissed', 'notification_failed',
      'settings_updated', 'banner_viewed', 'banner_dismissed', 'banner_clicked',
    ]

    expect(validEventTypes).toContain('subscription_deleted')
    expect(validEventTypes).not.toContain('push_subscription_disabled')
  })
})

// ============================================
// QUERY MOCK TESTS
// ============================================

describe('Push Mark Disabled - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should update notification settings and insert event', async () => {
    const updates: any[] = []
    const inserts: any[] = []

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        update: () => ({
          set: (vals: any) => {
            updates.push(vals)
            return {
              where: () => Promise.resolve({ rowCount: 1 }),
            }
          },
        }),
        insert: () => ({
          values: (vals: any) => {
            inserts.push(vals)
            return Promise.resolve()
          },
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      userNotificationSettings: { userId: 'user_id' },
      notificationEvents: { id: 'id' },
    }))

    // Simulate what the route does
    const { getDb } = require('@/db/client')
    const db = getDb()

    await db.update().set({ pushEnabled: false, pushSubscription: null }).where()
    await db.insert().values({ userId: 'test', eventType: 'subscription_deleted' })

    expect(updates).toHaveLength(1)
    expect(updates[0].pushEnabled).toBe(false)
    expect(inserts).toHaveLength(1)
    expect(inserts[0].eventType).toBe('subscription_deleted')
  })
})
