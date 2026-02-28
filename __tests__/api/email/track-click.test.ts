/**
 * Tests para email/track-click: schemas + queries + UA helpers
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { emailTrackClickQuerySchema } from '@/lib/api/email-tracking/schemas'
import { getDeviceType, getEmailClient } from '@/lib/api/email-tracking/helpers'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Email Track Click - Schemas', () => {
  describe('emailTrackClickQuerySchema', () => {
    it('should accept valid track-click params', () => {
      const result = emailTrackClickQuerySchema.safeParse({
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        email_type: 'welcome',
        campaign_id: 'camp-123',
        template_id: 'tmpl-456',
        url: 'https://www.vence.es/test',
        redirect: 'https://www.vence.es',
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty params', () => {
      const result = emailTrackClickQuerySchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it('should reject invalid user_id', () => {
      const result = emailTrackClickQuerySchema.safeParse({ user_id: 'bad' })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// UA HELPER TESTS
// ============================================

describe('Email Track Click - UA Helpers', () => {
  describe('getDeviceType', () => {
    it('should detect mobile', () => {
      expect(getDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)')).toBe('mobile')
    })

    it('should detect tablet', () => {
      expect(getDeviceType('Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X)')).toBe('tablet')
    })

    it('should detect desktop', () => {
      expect(getDeviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')).toBe('desktop')
    })

    it('should default to desktop for empty string', () => {
      expect(getDeviceType('')).toBe('desktop')
    })
  })

  describe('getEmailClient', () => {
    it('should detect Outlook', () => {
      expect(getEmailClient('Microsoft Outlook 16.0')).toBe('Outlook')
    })

    it('should detect Gmail', () => {
      expect(getEmailClient('GoogleImageProxy Gmail')).toBe('Gmail')
    })

    it('should detect Thunderbird', () => {
      expect(getEmailClient('Thunderbird 102.0')).toBe('Thunderbird')
    })

    it('should detect Chrome Webmail', () => {
      expect(getEmailClient('Mozilla/5.0 Chrome/120.0')).toBe('Chrome Webmail')
    })

    it('should return Unknown for empty string', () => {
      expect(getEmailClient('')).toBe('Unknown')
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Email Track Click - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should get user email by profile', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ email: 'test@example.com' }]),
            }),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: { id: 'id', email: 'email' },
    }))

    const { getUserEmailByProfile } = require('@/lib/api/email-tracking/queries')
    const email = await getUserEmailByProfile('550e8400-e29b-41d4-a716-446655440000')
    expect(email).toBe('test@example.com')
  })

  it('should return null when user not found', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: { id: 'id', email: 'email' },
    }))

    const { getUserEmailByProfile } = require('@/lib/api/email-tracking/queries')
    const email = await getUserEmailByProfile('nonexistent')
    expect(email).toBeNull()
  })
})
