/**
 * Tests para admin-newsletters-history: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  newsletterHistoryParamsSchema,
  newsletterHistoryResponseSchema,
  campaignUsersResponseSchema,
} from '@/lib/api/admin-newsletters-history/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Newsletters History - Schemas', () => {
  describe('newsletterHistoryParamsSchema', () => {
    it('should accept valid params', () => {
      const result = newsletterHistoryParamsSchema.safeParse({
        limit: 50,
        offset: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should use defaults for missing values', () => {
      const result = newsletterHistoryParamsSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(50)
        expect(result.data.offset).toBe(0)
      }
    })

    it('should accept campaign user params', () => {
      const result = newsletterHistoryParamsSchema.safeParse({
        templateId: 'tmpl_123',
        date: '2025-01-15',
        eventType: 'opened',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid eventType', () => {
      const result = newsletterHistoryParamsSchema.safeParse({
        eventType: 'deleted',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('newsletterHistoryResponseSchema', () => {
    it('should accept valid response', () => {
      const result = newsletterHistoryResponseSchema.safeParse({
        success: true,
        newsletters: [{
          campaignId: 'camp_1',
          subject: 'Test Newsletter',
          templateId: 'tmpl_1',
          emailContent: 'Preview...',
          sentAt: '2025-01-15T10:00:00Z',
          stats: {
            sent: 100,
            opened: 45,
            clicked: 10,
            bounced: 2,
            openRate: '45.0',
            clickRate: '10.0',
            veryActiveOpened: 20,
            activeOpened: 15,
            totalActiveOpened: 35,
            activeOpenRate: '77.8',
          },
          recipientCount: 100,
        }],
        total: 1,
        pagination: { limit: 50, offset: 0, hasMore: false },
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty newsletters', () => {
      const result = newsletterHistoryResponseSchema.safeParse({
        success: true,
        newsletters: [],
        total: 0,
        pagination: { limit: 50, offset: 0, hasMore: false },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('campaignUsersResponseSchema', () => {
    it('should accept valid campaign users response', () => {
      const result = campaignUsersResponseSchema.safeParse({
        success: true,
        users: [{
          userId: '550e8400-e29b-41d4-a716-446655440000',
          email: 'test@example.com',
          fullName: 'Test User',
          timestamp: '2025-01-15T10:00:00Z',
          avgScore: 7.5,
          accountAgeDays: 30,
          lastTestDate: '2025-01-14T10:00:00Z',
          activityLevel: 'very_active',
          daysSinceLastTest: 1,
        }],
        total: 1,
        metrics: {
          veryActive: 1,
          active: 0,
          totalActive: 1,
          veryActivePercentage: '100.0',
          activePercentage: '100.0',
        },
        templateId: 'tmpl_1',
        date: '2025-01-15',
        eventType: 'opened',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Newsletters History - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getNewsletterHistory should return events', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                { emailType: 'newsletter', eventType: 'sent', createdAt: '2025-01-15T10:00:00Z' },
              ]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      emailEvents: {},
      adminUsersWithRoles: {},
    }))

    const { getNewsletterHistory } = require('@/lib/api/admin-newsletters-history/queries')
    const result = await getNewsletterHistory()
    expect(result).toHaveLength(1)
  })

  it('getUserActivity should handle empty array', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({}),
    }))
    jest.doMock('@/db/schema', () => ({
      emailEvents: {},
      adminUsersWithRoles: {},
    }))

    const { getUserActivity } = require('@/lib/api/admin-newsletters-history/queries')
    const result = await getUserActivity([])
    expect(result).toHaveLength(0)
  })
})
