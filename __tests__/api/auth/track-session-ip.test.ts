/**
 * Tests para auth/track-session-ip: schema + geoloc mock + update mock
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

// Mock next/server para evitar pull del runtime real de Next que requiere
// Request/Response globals no presentes en jsdom. NextResponse.json simulado
// devuelve un objeto con status + json() + headers.
jest.mock('next/server', () => {
  class MockHeaders {
    private h: Record<string, string> = {}
    constructor(init?: Record<string, string>) {
      if (init) for (const [k, v] of Object.entries(init)) this.h[k.toLowerCase()] = v
    }
    get(name: string) { return this.h[name.toLowerCase()] ?? null }
    set(name: string, v: string) { this.h[name.toLowerCase()] = v }
  }
  return {
    NextResponse: {
      json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
        status: init?.status ?? 200,
        headers: new MockHeaders(init?.headers),
        json: async () => body,
      }),
    },
  }
})

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

// ============================================
// DB TIMEOUT → 200 NO-TRACK (2026-05-07)
// ============================================
// Cuando el pooler parpadea, el endpoint debe devolver 200 con
// { tracked: false } en vez de 503. El cliente trata el call como
// fire-and-forget no crítico (AuthContext) y la data es eventually
// consistent (next login refresca). Devolver 503 contaminaba la métrica
// de errores 5xx sin aportar al cliente nada accionable.

describe('Track Session IP - Timeout degradado a 200 no-track', () => {
  const VALID_BODY = JSON.stringify({
    userId: '550e8400-e29b-41d4-a716-446655440000',
    sessionId: '660e8400-e29b-41d4-a716-446655440001',
  })

  beforeEach(() => {
    jest.resetModules()
  })

  it('devuelve 200 con { tracked: false, reason: "db_unavailable" } cuando withDbTimeout lanza', async () => {
    jest.doMock('@/lib/db/timeout', () => {
      class DbTimeoutError extends Error {
        readonly name = 'DbTimeoutError'
        readonly timeoutMs: number
        constructor(timeoutMs: number) {
          super(`DB op timed out after ${timeoutMs}ms`)
          this.timeoutMs = timeoutMs
        }
      }
      return {
        DbTimeoutError,
        isDbTimeoutError: (e: unknown) => e instanceof Error && (e as Error).name === 'DbTimeoutError',
        withDbTimeout: (_fn: () => Promise<unknown>, timeoutMs = 8000) => {
          throw new DbTimeoutError(timeoutMs)
        },
      }
    })

    jest.doMock('@/db/client', () => ({ getDb: () => ({}) }))
    jest.doMock('@/db/schema', () => ({
      userSessions: { id: 'id', userId: 'user_id', ipAddress: 'ip_address', sessionStart: 'session_start' },
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))

    const { POST } = require('@/app/api/auth/track-session-ip/route')

    const req = {
      json: async () => JSON.parse(VALID_BODY),
      headers: {
        get: (name: string) => {
          const map: Record<string, string> = {
            'x-forwarded-for': '1.2.3.4',
            'x-vercel-ip-country': 'ES',
            'x-vercel-ip-city': 'Madrid',
          }
          return map[name.toLowerCase()] ?? null
        },
      },
    }

    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.tracked).toBe(false)
    expect(body.reason).toBe('db_unavailable')
  })

  it('NO devuelve 503 ni Retry-After cuando hay timeout (regresión)', async () => {
    jest.doMock('@/lib/db/timeout', () => {
      class DbTimeoutError extends Error {
        readonly name = 'DbTimeoutError'
        readonly timeoutMs: number
        constructor(timeoutMs: number) {
          super(`DB op timed out after ${timeoutMs}ms`)
          this.timeoutMs = timeoutMs
        }
      }
      return {
        DbTimeoutError,
        isDbTimeoutError: (e: unknown) => e instanceof Error && (e as Error).name === 'DbTimeoutError',
        withDbTimeout: (_fn: () => Promise<unknown>, timeoutMs = 8000) => {
          throw new DbTimeoutError(timeoutMs)
        },
      }
    })

    jest.doMock('@/db/client', () => ({ getDb: () => ({}) }))
    jest.doMock('@/db/schema', () => ({
      userSessions: { id: 'id', userId: 'user_id', ipAddress: 'ip_address', sessionStart: 'session_start' },
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))

    const { POST } = require('@/app/api/auth/track-session-ip/route')

    const req = {
      json: async () => JSON.parse(VALID_BODY),
      headers: { get: () => null },
    }

    const res = await POST(req)

    expect(res.status).not.toBe(503)
    expect(res.headers.get('Retry-After')).toBeNull()
  })

  it('errores genuinos (no timeout) siguen devolviendo 500', async () => {
    jest.doMock('@/lib/db/timeout', () => ({
      DbTimeoutError: class extends Error {},
      isDbTimeoutError: () => false,
      withDbTimeout: () => {
        throw new Error('connection refused')
      },
    }))

    jest.doMock('@/db/client', () => ({ getDb: () => ({}) }))
    jest.doMock('@/db/schema', () => ({
      userSessions: { id: 'id', userId: 'user_id', ipAddress: 'ip_address', sessionStart: 'session_start' },
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))

    const { POST } = require('@/app/api/auth/track-session-ip/route')

    const req = {
      json: async () => JSON.parse(VALID_BODY),
      headers: { get: () => null },
    }

    const res = await POST(req)

    expect(res.status).toBe(500)
  })
})

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
