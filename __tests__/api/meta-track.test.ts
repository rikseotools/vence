/**
 * Tests para meta/track: schema only (no DB, delegates to metaConversionsAPI)
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

// Schemas
const metaTrackSchema = z.object({
  eventName: z.string().min(1),
  email: z.string().optional(),
  userId: z.string().optional(),
  fbclid: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  eventSourceUrl: z.string().optional(),
  customData: z.record(z.unknown()).default({}),
})

const metaTrackResponseSchema = z.object({
  success: z.boolean(),
  eventId: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Meta Track - Schemas', () => {
  describe('metaTrackSchema (request)', () => {
    it('should accept CompleteRegistration event', () => {
      const result = metaTrackSchema.safeParse({
        eventName: 'CompleteRegistration',
        email: 'test@example.com',
        userId: 'user123',
        fbclid: 'fbclid123',
        customData: { registration_source: 'meta' },
      })
      expect(result.success).toBe(true)
    })

    it('should accept Lead event', () => {
      const result = metaTrackSchema.safeParse({
        eventName: 'Lead',
        email: 'test@example.com',
      })
      expect(result.success).toBe(true)
    })

    it('should accept Purchase event with customData', () => {
      const result = metaTrackSchema.safeParse({
        eventName: 'Purchase',
        email: 'test@example.com',
        customData: {
          value: 19.99,
          currency: 'EUR',
          orderId: 'order-123',
          productName: 'Premium Plan',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should accept InitiateCheckout event', () => {
      const result = metaTrackSchema.safeParse({
        eventName: 'InitiateCheckout',
        customData: { value: 9.99 },
      })
      expect(result.success).toBe(true)
    })

    it('should accept custom event', () => {
      const result = metaTrackSchema.safeParse({
        eventName: 'CustomEvent',
        customData: { key: 'value' },
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty eventName', () => {
      const result = metaTrackSchema.safeParse({
        eventName: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing eventName', () => {
      const result = metaTrackSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should default customData to empty object', () => {
      const result = metaTrackSchema.safeParse({ eventName: 'Test' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.customData).toEqual({})
    })

    it('should accept all optional fields', () => {
      const result = metaTrackSchema.safeParse({
        eventName: 'Test',
        email: 'a@b.com',
        userId: 'user1',
        fbclid: 'fbc1',
        fbc: 'fb.1.123.456',
        fbp: 'fb.1.789.012',
        eventSourceUrl: 'https://vence.es',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('metaTrackResponseSchema', () => {
    it('should accept success response', () => {
      const result = metaTrackResponseSchema.safeParse({
        success: true,
        eventId: 'evt-123',
        message: 'Evento CompleteRegistration enviado a Meta',
      })
      expect(result.success).toBe(true)
    })

    it('should accept error response', () => {
      const result = metaTrackResponseSchema.safeParse({
        success: false,
        error: 'Meta API not configured',
        eventId: 'evt-456',
      })
      expect(result.success).toBe(true)
    })

    it('should accept minimal response', () => {
      const result = metaTrackResponseSchema.safeParse({ success: true })
      expect(result.success).toBe(true)
    })
  })
})
