/**
 * Tests para email/track-open: schemas + queries + UA helpers
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { emailTrackOpenQuerySchema } from '@/lib/api/email-tracking/schemas'
import { getDeviceType, getEmailClient } from '@/lib/api/email-tracking/helpers'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Email Track Open - Schemas', () => {
  describe('emailTrackOpenQuerySchema', () => {
    it('should accept valid track-open params', () => {
      const result = emailTrackOpenQuerySchema.safeParse({
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        email_type: 'welcome',
        campaign_id: 'camp-123',
        template_id: 'tmpl-456',
        timestamp: '2025-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty params', () => {
      const result = emailTrackOpenQuerySchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should reject invalid user_id', () => {
      const result = emailTrackOpenQuerySchema.safeParse({ user_id: 'bad' })
      expect(result.success).toBe(false)
    })

    it('should accept all fields optional', () => {
      const result = emailTrackOpenQuerySchema.safeParse({
        campaign_id: 'c1',
        template_id: 't1',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// UA HELPER TESTS
// ============================================

describe('Email Track Open - UA Helpers', () => {
  describe('getDeviceType', () => {
    it('should detect Android mobile', () => {
      expect(getDeviceType('Mozilla/5.0 (Linux; Android 12; Pixel 6)')).toBe('mobile')
    })

    it('should detect Silk tablet', () => {
      expect(getDeviceType('Mozilla/5.0 (Linux; Android; Silk/98.4)')).toBe('tablet')
    })
  })

  describe('getEmailClient', () => {
    it('should detect Apple Mail', () => {
      expect(getEmailClient('Apple Mail (2.3654.60.2)')).toBe('Apple Mail')
    })

    it('should detect Yahoo Mail', () => {
      expect(getEmailClient('YahooMailProxy Yahoo Mail')).toBe('Yahoo Mail')
    })

    it('should detect Firefox Webmail', () => {
      expect(getEmailClient('Mozilla/5.0 Firefox/120.0')).toBe('Firefox Webmail')
    })

    it('should detect Safari Webmail', () => {
      expect(getEmailClient('Mozilla/5.0 Safari/605.1')).toBe('Safari Webmail')
    })

    it('should detect Edge Webmail', () => {
      expect(getEmailClient('Mozilla/5.0 Edg/120.0 Edge/120')).toBe('Edge Webmail')
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Email Track Open - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should record open event with all fields', async () => {
    const insertedValues: any[] = []

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        insert: () => ({
          values: (vals: any) => {
            insertedValues.push(vals)
            return Promise.resolve()
          },
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      emailEvents: { id: 'id' },
    }))

    const { recordEmailEvent } = require('@/lib/api/email-tracking/queries')
    const success = await recordEmailEvent({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      eventType: 'opened',
      emailType: 'welcome',
      emailAddress: 'test@example.com',
      openCount: 1,
      deviceType: 'mobile',
      clientName: 'Gmail',
      ipAddress: '1.2.3.4',
      userAgent: 'TestAgent',
    })

    expect(success).toBe(true)
    expect(insertedValues).toHaveLength(1)
    expect(insertedValues[0].eventType).toBe('opened')
    expect(insertedValues[0].emailType).toBe('welcome')
  })
})
