/**
 * Tests para email-tracking/click: schemas + queries (dedup + insert)
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { emailClickQuerySchema } from '@/lib/api/email-tracking/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Email Tracking Click - Schemas', () => {
  describe('emailClickQuerySchema', () => {
    it('should accept valid click params', () => {
      const result = emailClickQuerySchema.safeParse({
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        email_type: 'motivation',
        action: 'cta_click',
        redirect: 'https://www.vence.es/test',
      })
      expect(result.success).toBe(true)
    })

    it('should default email_type to motivation', () => {
      const result = emailClickQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.email_type).toBe('motivation')
    })

    it('should default action to unknown', () => {
      const result = emailClickQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.action).toBe('unknown')
    })

    it('should accept without user_id', () => {
      const result = emailClickQuerySchema.safeParse({ action: 'test' })
      expect(result.success).toBe(true)
    })

    it('should reject invalid user_id', () => {
      const result = emailClickQuerySchema.safeParse({ user_id: 'not-a-uuid' })
      expect(result.success).toBe(false)
    })

    it('should reject invalid redirect URL', () => {
      const result = emailClickQuerySchema.safeParse({ redirect: 'not-a-url' })
      expect(result.success).toBe(false)
    })

    it('should accept valid campaign_id and template_id', () => {
      const result = emailClickQuerySchema.safeParse({
        campaign_id: 'camp-123',
        template_id: 'tmpl-456',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.campaign_id).toBe('camp-123')
        expect(result.data.template_id).toBe('tmpl-456')
      }
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Email Tracking Click - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function setupCheckRecentMock(hasRecent: boolean) {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(hasRecent ? [{ id: 'existing' }] : []),
            }),
          }),
        }),
        insert: () => ({
          values: () => Promise.resolve(),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      emailEvents: {
        id: 'id',
        userId: 'user_id',
        eventType: 'event_type',
        emailType: 'email_type',
        createdAt: 'created_at',
      },
      userProfiles: {
        id: 'id',
        email: 'email',
      },
    }))
  }

  it('should detect duplicate events within window', async () => {
    setupCheckRecentMock(true)
    const { checkRecentEvent } = require('@/lib/api/email-tracking/queries')
    const isDup = await checkRecentEvent('user-id', 'clicked', 'motivation', 2)
    expect(isDup).toBe(true)
  })

  it('should allow new events outside window', async () => {
    setupCheckRecentMock(false)
    const { checkRecentEvent } = require('@/lib/api/email-tracking/queries')
    const isDup = await checkRecentEvent('user-id', 'clicked', 'motivation', 2)
    expect(isDup).toBe(false)
  })
})
