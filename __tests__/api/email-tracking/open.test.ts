/**
 * Tests para email-tracking/open: schemas + queries (dedup + insert)
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { emailOpenQuerySchema } from '@/lib/api/email-tracking/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Email Tracking Open - Schemas', () => {
  describe('emailOpenQuerySchema', () => {
    it('should accept valid open params', () => {
      const result = emailOpenQuerySchema.safeParse({
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        email_type: 'welcome',
        campaign_id: 'camp-123',
      })
      expect(result.success).toBe(true)
    })

    it('should default email_type to motivation', () => {
      const result = emailOpenQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.email_type).toBe('motivation')
    })

    it('should accept without user_id', () => {
      const result = emailOpenQuerySchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should reject invalid user_id', () => {
      const result = emailOpenQuerySchema.safeParse({ user_id: 'bad' })
      expect(result.success).toBe(false)
    })

    it('should accept optional email_id', () => {
      const result = emailOpenQuerySchema.safeParse({ email_id: 'some-id' })
      expect(result.success).toBe(true)
    })

    it('should accept optional timestamp', () => {
      const result = emailOpenQuerySchema.safeParse({ timestamp: '2025-01-01T00:00:00Z' })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Email Tracking Open - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function setupRecordMock(shouldSucceed: boolean) {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        insert: () => ({
          values: () => shouldSucceed ? Promise.resolve() : Promise.reject(new Error('DB error')),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      emailEvents: {
        id: 'id',
        userId: 'user_id',
        eventType: 'event_type',
        emailType: 'email_type',
        emailAddress: 'email_address',
        createdAt: 'created_at',
      },
    }))
  }

  it('should record email event successfully', async () => {
    setupRecordMock(true)
    const { recordEmailEvent } = require('@/lib/api/email-tracking/queries')
    const success = await recordEmailEvent({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      eventType: 'opened',
      emailType: 'motivation',
      emailAddress: 'test@example.com',
    })
    expect(success).toBe(true)
  })

  it('should return false on DB error', async () => {
    setupRecordMock(false)
    const { recordEmailEvent } = require('@/lib/api/email-tracking/queries')
    const success = await recordEmailEvent({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      eventType: 'opened',
      emailType: 'motivation',
      emailAddress: 'test@example.com',
    })
    expect(success).toBe(false)
  })
})
