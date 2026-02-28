/**
 * Tests para admin mark-conversation-viewed: schema validation
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

const requestSchema = z.object({
  conversationId: z.string().uuid()
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Mark Conversation Viewed - Schemas', () => {
  describe('requestSchema', () => {
    it('should accept valid UUID conversationId', () => {
      const result = requestSchema.safeParse({
        conversationId: '550e8400-e29b-41d4-a716-446655440000'
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing conversationId', () => {
      const result = requestSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID', () => {
      const result = requestSchema.safeParse({
        conversationId: 'not-a-uuid'
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty string', () => {
      const result = requestSchema.safeParse({
        conversationId: ''
      })
      expect(result.success).toBe(false)
    })
  })
})
