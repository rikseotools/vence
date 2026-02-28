/**
 * Tests para admin-send-push-notification: schema only (queries inline)
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

// Inline schemas since this route has no lib module
const sendPushNotificationRequestSchema = z.object({
  notification: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    icon: z.string().optional(),
    badge: z.string().optional(),
    data: z.record(z.unknown()).optional(),
    actions: z.array(z.unknown()).optional(),
    requireInteraction: z.boolean().optional(),
    tag: z.string().optional(),
  }),
  targetType: z.enum(['all', 'active_users']).default('all'),
})

const sendPushNotificationResponseSchema = z.object({
  success: z.boolean(),
  sent: z.number().int().min(0).optional(),
  failed: z.number().int().min(0).optional(),
  total: z.number().int().min(0).optional(),
  message: z.string().optional(),
  mode: z.string().optional(),
  error: z.string().optional(),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Send Push Notification - Schemas', () => {
  describe('sendPushNotificationRequestSchema', () => {
    it('should accept valid request', () => {
      const result = sendPushNotificationRequestSchema.safeParse({
        notification: {
          title: 'Test Title',
          body: 'Test Body',
        },
        targetType: 'all',
      })
      expect(result.success).toBe(true)
    })

    it('should use default targetType', () => {
      const result = sendPushNotificationRequestSchema.safeParse({
        notification: {
          title: 'Test',
          body: 'Body',
        },
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.targetType).toBe('all')
      }
    })

    it('should accept active_users targetType', () => {
      const result = sendPushNotificationRequestSchema.safeParse({
        notification: {
          title: 'Test',
          body: 'Body',
        },
        targetType: 'active_users',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid targetType', () => {
      const result = sendPushNotificationRequestSchema.safeParse({
        notification: {
          title: 'Test',
          body: 'Body',
        },
        targetType: 'premium_only',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing notification', () => {
      const result = sendPushNotificationRequestSchema.safeParse({
        targetType: 'all',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty title', () => {
      const result = sendPushNotificationRequestSchema.safeParse({
        notification: {
          title: '',
          body: 'Body',
        },
      })
      expect(result.success).toBe(false)
    })

    it('should accept notification with full options', () => {
      const result = sendPushNotificationRequestSchema.safeParse({
        notification: {
          title: 'Title',
          body: 'Body',
          icon: '/icon.png',
          badge: '/badge.png',
          data: { url: '/test' },
          actions: [{ action: 'open', title: 'Open' }],
          requireInteraction: true,
          tag: 'custom_tag',
        },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('sendPushNotificationResponseSchema', () => {
    it('should accept success response', () => {
      const result = sendPushNotificationResponseSchema.safeParse({
        success: true,
        sent: 50,
        failed: 2,
        total: 52,
        message: 'Notificación enviada a 50 dispositivos (2 fallidas)',
      })
      expect(result.success).toBe(true)
    })

    it('should accept simulated response', () => {
      const result = sendPushNotificationResponseSchema.safeParse({
        success: true,
        sent: 10,
        failed: 0,
        total: 10,
        message: '[SIMULADO] Notificación enviada a 10 dispositivos',
        mode: 'simulated',
      })
      expect(result.success).toBe(true)
    })

    it('should accept zero sent', () => {
      const result = sendPushNotificationResponseSchema.safeParse({
        success: true,
        sent: 0,
        message: 'No hay suscripciones push activas',
      })
      expect(result.success).toBe(true)
    })

    it('should accept error response', () => {
      const result = sendPushNotificationResponseSchema.safeParse({
        success: false,
        error: 'No autorizado',
      })
      expect(result.success).toBe(true)
    })
  })
})
