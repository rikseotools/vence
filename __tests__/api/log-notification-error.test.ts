/**
 * Tests para log-notification-error: schema only (no DB)
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

// Schemas
const notificationErrorSchema = z.object({
  error: z.string(),
  details: z.object({
    userId: z.string().optional(),
    userEmail: z.string().optional(),
    type: z.string().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
  }),
  timestamp: z.string().optional(),
})

const notificationErrorResponseSchema = z.object({
  status: z.literal('logged'),
  timestamp: z.string(),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Log Notification Error - Schemas', () => {
  describe('notificationErrorSchema (request)', () => {
    it('should accept valid error with all details', () => {
      const result = notificationErrorSchema.safeParse({
        error: 'NOTIFICATION_SEND_FAILED',
        details: {
          userId: 'user123',
          userEmail: 'test@example.com',
          type: 'motivation',
          title: 'Test Title',
          body: 'Test Body',
        },
        timestamp: '2025-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('should accept error with minimal details', () => {
      const result = notificationErrorSchema.safeParse({
        error: 'MISSING_FIELDS',
        details: {},
      })
      expect(result.success).toBe(true)
    })

    it('should accept MISSING placeholders', () => {
      const result = notificationErrorSchema.safeParse({
        error: 'NOTIFICATION_CONTENT_MISSING',
        details: {
          type: 'MISSING',
          title: 'MISSING',
          body: 'MISSING',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing error field', () => {
      const result = notificationErrorSchema.safeParse({
        details: { userId: 'test' },
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing details', () => {
      const result = notificationErrorSchema.safeParse({
        error: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('should accept without timestamp', () => {
      const result = notificationErrorSchema.safeParse({
        error: 'test',
        details: {},
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.timestamp).toBeUndefined()
    })
  })

  describe('notificationErrorResponseSchema', () => {
    it('should accept valid logged response', () => {
      const result = notificationErrorResponseSchema.safeParse({
        status: 'logged',
        timestamp: '2025-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('should reject status other than logged', () => {
      const result = notificationErrorResponseSchema.safeParse({
        status: 'error',
        timestamp: '2025-01-01T00:00:00Z',
      })
      expect(result.success).toBe(false)
    })
  })
})
