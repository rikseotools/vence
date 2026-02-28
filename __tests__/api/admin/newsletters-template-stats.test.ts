/**
 * Tests para newsletters/template-stats: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  templateStatsResponseSchema,
} from '@/lib/api/newsletters/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Newsletter Template Stats - Schemas', () => {
  describe('templateStatsResponseSchema', () => {
    it('should accept valid response', () => {
      const result = templateStatsResponseSchema.safeParse({
        success: true,
        templateStats: {
          'welcome_email': {
            templateId: 'welcome_email',
            emailType: 'welcome',
            lastSubject: 'Bienvenido!',
            totalSent: 100,
            totalDelivered: 95,
            totalOpened: 50,
            totalClicked: 20,
            totalBounced: 5,
            totalComplained: 0,
            totalUnsubscribed: 2,
            openRate: 50,
            clickRate: 40,
            bounceRate: 5,
            complaintRate: 0,
            lastSent: '2025-01-01T00:00:00Z',
            uniqueOpeners: 45,
            uniqueClickers: 18
          }
        }
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty template stats', () => {
      const result = templateStatsResponseSchema.safeParse({
        success: true,
        templateStats: {}
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative counts', () => {
      const result = templateStatsResponseSchema.safeParse({
        success: true,
        templateStats: {
          'test': {
            templateId: 'test',
            emailType: 'test',
            lastSubject: null,
            totalSent: -1,
            totalDelivered: 0,
            totalOpened: 0,
            totalClicked: 0,
            totalBounced: 0,
            totalComplained: 0,
            totalUnsubscribed: 0,
            openRate: 0,
            clickRate: 0,
            bounceRate: 0,
            complaintRate: 0,
            lastSent: null,
            uniqueOpeners: 0,
            uniqueClickers: 0
          }
        }
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Newsletter Template Stats - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should aggregate events by template', async () => {
    const mockEvents = [
      { templateId: 'tpl1', emailType: 'newsletter', eventType: 'sent', createdAt: '2025-06-01', subject: 'News', userId: 'u1' },
      { templateId: 'tpl1', emailType: 'newsletter', eventType: 'sent', createdAt: '2025-06-01', subject: 'News', userId: 'u2' },
      { templateId: 'tpl1', emailType: 'newsletter', eventType: 'opened', createdAt: '2025-06-02', subject: 'News', userId: 'u1' },
      { templateId: 'tpl1', emailType: 'newsletter', eventType: 'clicked', createdAt: '2025-06-02', subject: 'News', userId: 'u1' },
      { templateId: 'tpl1', emailType: 'newsletter', eventType: 'bounced', createdAt: '2025-06-02', subject: 'News', userId: 'u3' },
    ]

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve(mockEvents)
          })
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      emailEvents: {
        templateId: 'template_id',
        emailType: 'email_type',
        eventType: 'event_type',
        createdAt: 'created_at',
        subject: 'subject',
        userId: 'user_id'
      },
      userProfiles: {},
      emailPreferences: {},
      adminUsersWithRoles: {}
    }))

    const { getTemplateStats } = require('@/lib/api/newsletters/queries')
    const result = await getTemplateStats()

    expect(result.success).toBe(true)
    expect(result.templateStats['tpl1']).toBeDefined()

    const stats = result.templateStats['tpl1']
    expect(stats.totalSent).toBe(2)
    expect(stats.totalOpened).toBe(1)
    expect(stats.totalClicked).toBe(1)
    expect(stats.totalBounced).toBe(1)
    expect(stats.uniqueOpeners).toBe(1)
    expect(stats.uniqueClickers).toBe(1)
    expect(stats.openRate).toBe(50) // 1 unique opener / 2 sent * 100
    expect(stats.clickRate).toBe(100) // 1 unique clicker / 1 opened * 100
    expect(stats.bounceRate).toBe(50) // 1 bounced / 2 sent * 100
  })

  it('should handle empty events', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([])
          })
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      emailEvents: { templateId: 'template_id', emailType: 'email_type', eventType: 'event_type', createdAt: 'created_at', subject: 'subject', userId: 'user_id' },
      userProfiles: {},
      emailPreferences: {},
      adminUsersWithRoles: {}
    }))

    const { getTemplateStats } = require('@/lib/api/newsletters/queries')
    const result = await getTemplateStats()

    expect(result.success).toBe(true)
    expect(Object.keys(result.templateStats).length).toBe(0)
  })
})
