/**
 * Tests para debug-unsubscribe: HMAC logic + schema
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import crypto from 'crypto'
import { z } from 'zod/v3'

// Schema para response
const debugUnsubscribeResponseSchema = z.object({
  timestamp: z.string(),
  email: z.string(),
  environment: z.record(z.string()),
  token_generation: z.object({
    status: z.string(),
    token: z.string().optional(),
    secret_length: z.number().optional(),
    error: z.string().optional(),
  }).nullable(),
  supabase_connection: z.object({
    status: z.string(),
  }).nullable(),
  user_lookup: z.object({
    status: z.string(),
  }).nullable(),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Debug Unsubscribe - Schemas', () => {
  describe('debugUnsubscribeResponseSchema', () => {
    it('should accept valid response', () => {
      const result = debugUnsubscribeResponseSchema.safeParse({
        timestamp: '2025-01-01T00:00:00Z',
        email: 'test@example.com',
        environment: {
          NODE_ENV: 'development',
          SUPABASE_URL: '✅ Set',
          SERVICE_KEY: '✅ Set',
          ANON_KEY: '✅ Set',
          UNSUBSCRIBE_SECRET: '✅ Set',
        },
        token_generation: { status: '✅ Success', token: 'abc123', secret_length: 26 },
        supabase_connection: { status: '✅ Connected' },
        user_lookup: { status: '✅ Query successful' },
      })
      expect(result.success).toBe(true)
    })

    it('should accept response with null sections', () => {
      const result = debugUnsubscribeResponseSchema.safeParse({
        timestamp: '2025-01-01T00:00:00Z',
        email: 'test@example.com',
        environment: {},
        token_generation: null,
        supabase_connection: null,
        user_lookup: null,
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// HMAC LOGIC TESTS
// ============================================

describe('Debug Unsubscribe - HMAC Logic', () => {
  const secret = 'ilovetest-unsubscribe-2025'

  function generateToken(email: string, secretKey: string): string {
    return crypto
      .createHmac('sha256', secretKey)
      .update(email)
      .digest('hex')
      .substring(0, 16)
  }

  it('should generate deterministic tokens', () => {
    const token1 = generateToken('test@example.com', secret)
    const token2 = generateToken('test@example.com', secret)
    expect(token1).toBe(token2)
  })

  it('should generate different tokens for different emails', () => {
    const token1 = generateToken('user1@example.com', secret)
    const token2 = generateToken('user2@example.com', secret)
    expect(token1).not.toBe(token2)
  })

  it('should generate different tokens for different secrets', () => {
    const token1 = generateToken('test@example.com', 'secret1')
    const token2 = generateToken('test@example.com', 'secret2')
    expect(token1).not.toBe(token2)
  })

  it('should generate 16-character tokens', () => {
    const token = generateToken('test@example.com', secret)
    expect(token).toHaveLength(16)
  })

  it('should generate hex tokens', () => {
    const token = generateToken('test@example.com', secret)
    expect(/^[0-9a-f]+$/.test(token)).toBe(true)
  })
})
