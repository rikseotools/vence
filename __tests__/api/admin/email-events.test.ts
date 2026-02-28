/**
 * Tests para admin-email-events: schemas, queries y route
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  emailEventsQuerySchema,
  emailEventSchema,
  emailEventsResponseSchema,
} from '@/lib/api/admin-email-events/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Email Events - Schemas', () => {
  describe('emailEventsQuerySchema', () => {
    it('should accept valid timeRange', () => {
      const result = emailEventsQuerySchema.safeParse({ timeRange: 7 })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.timeRange).toBe(7)
    })

    it('should default to 30', () => {
      const result = emailEventsQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.timeRange).toBe(30)
    })

    it('should coerce string to number', () => {
      const result = emailEventsQuerySchema.safeParse({ timeRange: '14' })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.timeRange).toBe(14)
    })

    it('should reject timeRange < 1', () => {
      const result = emailEventsQuerySchema.safeParse({ timeRange: 0 })
      expect(result.success).toBe(false)
    })

    it('should reject timeRange > 365', () => {
      const result = emailEventsQuerySchema.safeParse({ timeRange: 400 })
      expect(result.success).toBe(false)
    })
  })

  describe('emailEventSchema', () => {
    const validEvent = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      userId: '660e8400-e29b-41d4-a716-446655440001',
      emailType: 'welcome',
      eventType: 'sent',
      emailAddress: 'test@example.com',
      subject: 'Welcome!',
      templateId: null,
      campaignId: null,
      emailContentPreview: null,
      linkClicked: null,
      clickCount: 0,
      openCount: 0,
      deviceType: null,
      clientName: null,
      ipAddress: null,
      userAgent: null,
      geolocation: null,
      errorDetails: null,
      createdAt: '2025-01-01T00:00:00Z',
    }

    it('should accept valid email event', () => {
      const result = emailEventSchema.safeParse(validEvent)
      expect(result.success).toBe(true)
    })

    it('should accept null userId', () => {
      const result = emailEventSchema.safeParse({ ...validEvent, userId: null })
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID for id', () => {
      const result = emailEventSchema.safeParse({ ...validEvent, id: 'not-uuid' })
      expect(result.success).toBe(false)
    })

    it('should reject missing emailType', () => {
      const { emailType, ...rest } = validEvent
      const result = emailEventSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })

    it('should reject missing emailAddress', () => {
      const { emailAddress, ...rest } = validEvent
      const result = emailEventSchema.safeParse(rest)
      expect(result.success).toBe(false)
    })
  })

  describe('emailEventsResponseSchema', () => {
    it('should accept valid response with events', () => {
      const result = emailEventsResponseSchema.safeParse({
        events: [{
          id: '550e8400-e29b-41d4-a716-446655440000',
          userId: null,
          emailType: 'welcome',
          eventType: 'sent',
          emailAddress: 'test@example.com',
          subject: null,
          templateId: null,
          campaignId: null,
          emailContentPreview: null,
          linkClicked: null,
          clickCount: 0,
          openCount: 0,
          deviceType: null,
          clientName: null,
          ipAddress: null,
          userAgent: null,
          geolocation: null,
          errorDetails: null,
          createdAt: '2025-01-01T00:00:00Z',
        }],
        totalEvents: 1,
        timeRange: '30',
        timestamp: '2025-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty events array', () => {
      const result = emailEventsResponseSchema.safeParse({
        events: [],
        totalEvents: 0,
        timeRange: '7',
        timestamp: '2025-01-01T00:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing timestamp', () => {
      const result = emailEventsResponseSchema.safeParse({
        events: [],
        totalEvents: 0,
        timeRange: '30',
      })
      expect(result.success).toBe(false)
    })

    it('should reject negative totalEvents', () => {
      const result = emailEventsResponseSchema.safeParse({
        events: [],
        totalEvents: -1,
        timeRange: '30',
        timestamp: '2025-01-01T00:00:00Z',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Admin Email Events - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function setupMock(events: any[]) {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(events),
            }),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      emailEvents: { createdAt: 'created_at' },
    }))
  }

  it('should return email events array', async () => {
    const mockEvents = [
      { id: '1', emailType: 'welcome', eventType: 'sent', emailAddress: 'a@b.com', createdAt: '2025-01-01' },
      { id: '2', emailType: 'welcome', eventType: 'opened', emailAddress: 'a@b.com', createdAt: '2025-01-02' },
    ]
    setupMock(mockEvents)
    const { getEmailEvents } = require('@/lib/api/admin-email-events/queries')
    const result = await getEmailEvents(30)

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('should return empty array when no events', async () => {
    setupMock([])
    const { getEmailEvents } = require('@/lib/api/admin-email-events/queries')
    const result = await getEmailEvents(7)

    expect(result).toEqual([])
  })
})

// ============================================
// ROUTE RESPONSE FORMAT (GET)
// ============================================

describe('Admin Email Events - Route response format', () => {
  it('should match schema for GET response', () => {
    const response = {
      events: [],
      totalEvents: 0,
      timeRange: '30',
      timestamp: new Date().toISOString(),
    }
    const parsed = emailEventsResponseSchema.safeParse(response)
    expect(parsed.success).toBe(true)
  })
})
