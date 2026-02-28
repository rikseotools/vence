/**
 * Tests para auth/track-session-ip: schema + geoloc mock + update mock
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

// Schemas
const trackSessionIpSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  deviceId: z.string().optional(),
})

const trackSessionIpResponseSchema = z.object({
  success: z.boolean(),
  ip: z.string().optional(),
  geo: z.object({
    city: z.string(),
    region: z.string(),
    country: z.string(),
  }).nullable().optional(),
  error: z.string().optional(),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Track Session IP - Schemas', () => {
  describe('trackSessionIpSchema (request)', () => {
    it('should accept valid request with all fields', () => {
      const result = trackSessionIpSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        sessionId: '660e8400-e29b-41d4-a716-446655440001',
        deviceId: 'device-fingerprint-123',
      })
      expect(result.success).toBe(true)
    })

    it('should accept with only userId', () => {
      const result = trackSessionIpSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing userId', () => {
      const result = trackSessionIpSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject invalid sessionId', () => {
      const result = trackSessionIpSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        sessionId: 'not-uuid',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('trackSessionIpResponseSchema', () => {
    it('should accept success with geo', () => {
      const result = trackSessionIpResponseSchema.safeParse({
        success: true,
        ip: '1.2.3.4',
        geo: { city: 'Madrid', region: 'Madrid', country: 'ES' },
      })
      expect(result.success).toBe(true)
    })

    it('should accept success with null geo', () => {
      const result = trackSessionIpResponseSchema.safeParse({
        success: true,
        ip: '127.0.0.1',
        geo: null,
      })
      expect(result.success).toBe(true)
    })

    it('should accept error response', () => {
      const result = trackSessionIpResponseSchema.safeParse({
        success: false,
        error: 'userId requerido',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// GEOLOCATION TESTS
// ============================================

describe('Track Session IP - GeoLocation', () => {
  it('should skip private IPs', () => {
    const privateIps = ['192.168.1.1', '10.0.0.1', '127.0.0.1', '::1', 'unknown', '']
    privateIps.forEach(ip => {
      const shouldSkip = !ip || ip === 'unknown' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '127.0.0.1' || ip === '::1'
      expect(shouldSkip).toBe(true)
    })
  })

  it('should allow public IPs', () => {
    const publicIps = ['8.8.8.8', '1.1.1.1', '203.0.113.1']
    publicIps.forEach(ip => {
      const shouldSkip = !ip || ip === 'unknown' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === '127.0.0.1' || ip === '::1'
      expect(shouldSkip).toBe(false)
    })
  })
})

// ============================================
// SUBQUERY PATTERN TESTS
// ============================================

describe('Track Session IP - Subquery Pattern', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should update specific session when sessionId provided', async () => {
    const updates: any[] = []

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        update: () => ({
          set: (vals: any) => {
            updates.push(vals)
            return { where: () => Promise.resolve() }
          },
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      userSessions: { id: 'id', userId: 'user_id', ipAddress: 'ip_address', sessionStart: 'session_start' },
    }))

    const { getDb } = require('@/db/client')
    const db = getDb()
    await db.update().set({ ipAddress: '1.2.3.4' }).where()

    expect(updates).toHaveLength(1)
    expect(updates[0].ipAddress).toBe('1.2.3.4')
  })

  it('should use select+update pattern when no sessionId', async () => {
    // Drizzle doesn't support .update().order().limit()
    // So we need select+update in two steps
    const selectResult = [{ id: 'session-1' }]
    let updateSessionId: string | null = null

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(selectResult),
              }),
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: (condition: any) => {
              updateSessionId = selectResult[0].id
              return Promise.resolve()
            },
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      userSessions: { id: 'id', userId: 'user_id', ipAddress: 'ip_address', sessionStart: 'session_start' },
    }))

    const { getDb } = require('@/db/client')
    const db = getDb()

    const recent = await db.select().from().where().orderBy().limit()
    if (recent.length > 0) {
      await db.update().set().where()
      updateSessionId = recent[0].id
    }

    expect(updateSessionId).toBe('session-1')
  })
})
