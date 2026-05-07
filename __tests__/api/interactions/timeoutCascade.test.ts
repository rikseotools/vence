// __tests__/api/interactions/timeoutCascade.test.ts
// Tests del quick-fail wrapper en /api/interactions (cascade prevention 2026-05-07).
// Garantiza que un blip de pool degrada a 200 { success: false, queued: false }
// en vez de bloquear el lambda 60s y saturar concurrency Vercel.

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

const VALID_SINGLE = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  eventType: 'test_answer_selected',
  eventCategory: 'test',
}

const VALID_BATCH = {
  events: [
    { userId: '550e8400-e29b-41d4-a716-446655440000', eventType: 'page_view', eventCategory: 'navigation' },
    { userId: '550e8400-e29b-41d4-a716-446655440000', eventType: 'click', eventCategory: 'ui' },
  ],
}

describe('/api/interactions — Cascade prevention (2026-05-07)', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('timeout en single → 200 { success: false, queued: false, reason: db_unavailable }', async () => {
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
        withDbTimeout: (_fn: () => Promise<unknown>, timeoutMs = 5000) => {
          throw new DbTimeoutError(timeoutMs)
        },
      }
    })
    jest.doMock('@/lib/api/interactions', () => ({
      safeParseInteractionRequest: () => ({ success: true, data: VALID_SINGLE }),
      safeParseInteractionBatchRequest: () => ({ success: true, data: VALID_BATCH }),
      trackInteraction: jest.fn(),
      trackBatchInteractions: jest.fn(),
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))

    const { POST } = require('@/app/api/interactions/route')

    const req = {
      json: async () => VALID_SINGLE,
    }
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      success: false,
      queued: false,
      reason: 'db_unavailable',
    })
  })

  it('timeout en batch → 200 { success: false, queued: false }', async () => {
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
        withDbTimeout: (_fn: () => Promise<unknown>, timeoutMs = 5000) => {
          throw new DbTimeoutError(timeoutMs)
        },
      }
    })
    jest.doMock('@/lib/api/interactions', () => ({
      safeParseInteractionRequest: () => ({ success: true, data: VALID_SINGLE }),
      safeParseInteractionBatchRequest: () => ({ success: true, data: VALID_BATCH }),
      trackInteraction: jest.fn(),
      trackBatchInteractions: jest.fn(),
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))

    const { POST } = require('@/app/api/interactions/route')

    const req = {
      json: async () => VALID_BATCH,
    }
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.queued).toBe(false)
  })

  it('regresión: timeout NO devuelve 504 ni espera maxDuration', async () => {
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
        withDbTimeout: (_fn: () => Promise<unknown>, timeoutMs = 5000) => {
          throw new DbTimeoutError(timeoutMs)
        },
      }
    })
    jest.doMock('@/lib/api/interactions', () => ({
      safeParseInteractionRequest: () => ({ success: true, data: VALID_SINGLE }),
      safeParseInteractionBatchRequest: () => ({ success: true, data: VALID_BATCH }),
      trackInteraction: jest.fn(),
      trackBatchInteractions: jest.fn(),
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))

    const { POST } = require('@/app/api/interactions/route')

    const t0 = Date.now()
    const res = await POST({ json: async () => VALID_SINGLE })
    const elapsed = Date.now() - t0

    expect(res.status).not.toBe(504)
    expect(res.status).not.toBe(503)
    expect(elapsed).toBeLessThan(1000) // no esperó nada
  })

  it('happy path: track exitoso devuelve 200 con success:true', async () => {
    jest.doMock('@/lib/db/timeout', () => ({
      DbTimeoutError: class extends Error {},
      isDbTimeoutError: () => false,
      withDbTimeout: (fn: () => Promise<unknown>) => fn(),
    }))
    jest.doMock('@/lib/api/interactions', () => ({
      safeParseInteractionRequest: () => ({ success: true, data: VALID_SINGLE }),
      safeParseInteractionBatchRequest: () => ({ success: true, data: VALID_BATCH }),
      trackInteraction: jest.fn().mockResolvedValue({ success: true, eventId: 'evt-1' }),
      trackBatchInteractions: jest.fn(),
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))

    const { POST } = require('@/app/api/interactions/route')

    const res = await POST({ json: async () => VALID_SINGLE })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.eventId).toBe('evt-1')
  })

  it('errores no-timeout siguen devolviendo 500', async () => {
    jest.doMock('@/lib/db/timeout', () => ({
      DbTimeoutError: class extends Error {},
      isDbTimeoutError: () => false,
      withDbTimeout: () => {
        throw new Error('connection refused')
      },
    }))
    jest.doMock('@/lib/api/interactions', () => ({
      safeParseInteractionRequest: () => ({ success: true, data: VALID_SINGLE }),
      safeParseInteractionBatchRequest: () => ({ success: true, data: VALID_BATCH }),
      trackInteraction: jest.fn(),
      trackBatchInteractions: jest.fn(),
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))

    const { POST } = require('@/app/api/interactions/route')
    const res = await POST({ json: async () => VALID_SINGLE })
    expect(res.status).toBe(500)
  })

  it('400 validation error sigue devolviendo 400 (no toca el timeout path)', async () => {
    jest.doMock('@/lib/db/timeout', () => ({
      DbTimeoutError: class extends Error {},
      isDbTimeoutError: () => false,
      withDbTimeout: (fn: () => Promise<unknown>) => fn(),
    }))
    jest.doMock('@/lib/api/interactions', () => ({
      safeParseInteractionRequest: () => ({ success: false, error: { issues: [{ message: 'bad' }] } }),
      safeParseInteractionBatchRequest: () => ({ success: false, error: { issues: [{ message: 'bad' }] } }),
      trackInteraction: jest.fn(),
      trackBatchInteractions: jest.fn(),
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))

    const { POST } = require('@/app/api/interactions/route')
    const res = await POST({ json: async () => ({ junk: true }) })
    expect(res.status).toBe(400)
  })
})
