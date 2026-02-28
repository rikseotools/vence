/**
 * Tests para debug-email-preferences: schema only (raw REST, no DB mock)
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

// Schema para validar response
const debugEmailPrefsResponseSchema = z.object({
  timestamp: z.string(),
  email: z.string(),
  user_id: z.string(),
  table_check: z.object({
    status: z.string(),
    status_code: z.number().optional(),
    error: z.string().nullable().optional(),
  }).nullable(),
  existing_preferences: z.object({
    status: z.string(),
    status_code: z.number(),
    preferences_found: z.boolean(),
    data: z.unknown(),
  }).nullable(),
  insert_test: z.object({
    status: z.string(),
    status_code: z.number(),
    response_body: z.string(),
    test_data: z.record(z.unknown()),
  }).nullable(),
})

// Schema for query params
const debugEmailPrefsQuerySchema = z.object({
  email: z.string().email().default('ilovetestpro@gmail.com'),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Debug Email Preferences - Schemas', () => {
  describe('debugEmailPrefsQuerySchema', () => {
    it('should default email to ilovetestpro', () => {
      const result = debugEmailPrefsQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.email).toBe('ilovetestpro@gmail.com')
    })

    it('should accept custom email', () => {
      const result = debugEmailPrefsQuerySchema.safeParse({ email: 'test@example.com' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = debugEmailPrefsQuerySchema.safeParse({ email: 'not-email' })
      expect(result.success).toBe(false)
    })
  })

  describe('debugEmailPrefsResponseSchema', () => {
    it('should accept valid response with all sections', () => {
      const result = debugEmailPrefsResponseSchema.safeParse({
        timestamp: '2025-01-01T00:00:00Z',
        email: 'test@example.com',
        user_id: 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256',
        table_check: { status: '✅ Table exists', status_code: 200, error: null },
        existing_preferences: { status: '✅ Query successful', status_code: 200, preferences_found: true, data: [] },
        insert_test: { status: '✅ Insert/Update successful', status_code: 201, response_body: 'Success', test_data: {} },
      })
      expect(result.success).toBe(true)
    })

    it('should accept response with null sections', () => {
      const result = debugEmailPrefsResponseSchema.safeParse({
        timestamp: '2025-01-01T00:00:00Z',
        email: 'test@example.com',
        user_id: 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256',
        table_check: null,
        existing_preferences: null,
        insert_test: null,
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing timestamp', () => {
      const result = debugEmailPrefsResponseSchema.safeParse({
        email: 'test@example.com',
        user_id: 'user1',
        table_check: null,
        existing_preferences: null,
        insert_test: null,
      })
      expect(result.success).toBe(false)
    })
  })
})
