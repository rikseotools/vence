// __tests__/api/random-test/availabilityStaleIfError.test.ts
// Tests del patrón stale-if-error en /api/random-test/availability (refactor 2026-05-11).
//
// Promoción de cache in-memory por-lambda → Redis L2 compartido.
// Fresh 60s + stale-if-error 24h.

export {}

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

const sampleAvailability = (n = 100) => ({
  total: n,
  neverSeen: Math.floor(n * 0.7),
  byTheme: { '1': Math.floor(n / 2), '2': Math.floor(n / 2) },
})

const buildPostReq = (body: Record<string, unknown> = {}) => ({
  url: 'https://www.vence.es/api/random-test/availability',
  headers: { get: () => null },
  json: async () => ({
    oposicion: 'auxiliar_administrativo_estado',
    selectedThemes: [1, 2],
    difficulty: 'random',
    numQuestions: 25,
    ...body,
  }),
})

describe('/api/random-test/availability — stale-if-error con Redis', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))
    jest.doMock('@/lib/db/timeout', () => {
      class DbTimeoutError extends Error {
        public readonly timeoutMs: number
        constructor(timeoutMs: number) {
          super(`Database operation exceeded ${timeoutMs}ms`)
          this.name = 'DbTimeoutError'
          this.timeoutMs = timeoutMs
        }
      }
      return {
        DbTimeoutError,
        isDbTimeoutError: (e: unknown) =>
          e instanceof Error && e.name === 'DbTimeoutError' && typeof (e as { timeoutMs?: unknown }).timeoutMs === 'number',
        withDbTimeout: jest.fn(),
      }
    })
    jest.doMock('@/lib/api/random-test/schemas', () => ({
      safeParseCheckAvailability: (p: Record<string, unknown>) => ({ success: true, data: p }),
    }))
  })

  it('fresh fast-path: cache <60s → 200 sin tocar BD', async () => {
    const queryFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return { ...actual, withDbTimeout: queryFn }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        value: sampleAvailability(150),
        ts: Date.now() - 10_000, // 10s de antigüedad (<60s = fresh)
      }),
      setCached: jest.fn(),
    }))
    jest.doMock('@/lib/api/random-test/queries', () => ({
      checkQuestionAvailability: jest.fn(),
    }))

    const { POST } = require('@/app/api/random-test/availability/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.availableQuestions).toBe(150)
    expect(queryFn).not.toHaveBeenCalled() // CRÍTICO: cache hit no toca BD
  })

  it('cache stale + BD OK → 200 con fresh + setCached refresca', async () => {
    const fresh = sampleAvailability(200)
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return { ...actual, withDbTimeout: jest.fn().mockResolvedValue(fresh) }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        value: sampleAvailability(99), // valor stale antiguo
        ts: Date.now() - 5 * 60_000, // 5 min stale (>60s)
      }),
      setCached: setCachedFn,
    }))
    jest.doMock('@/lib/api/random-test/queries', () => ({
      checkQuestionAvailability: jest.fn(),
    }))

    const { POST } = require('@/app/api/random-test/availability/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.availableQuestions).toBe(200) // valor fresh, NO stale
    expect(setCachedFn).toHaveBeenCalledTimes(1)
    expect(setCachedFn.mock.calls[0][0]).toMatch(/^random_avail:/)
    expect(setCachedFn.mock.calls[0][2]).toBe(86400) // 24h TTL
  })

  it('cache stale + BD timeout → 200 con stale (NO 503)', async () => {
    const staleValue = sampleAvailability(75)
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      const DbTimeoutError = actual.DbTimeoutError
      return { ...actual, withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(12000)) }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        value: staleValue,
        ts: Date.now() - 10 * 60_000, // 10 min stale
      }),
      setCached: jest.fn(),
    }))
    jest.doMock('@/lib/api/random-test/queries', () => ({
      checkQuestionAvailability: jest.fn(),
    }))

    const { POST } = require('@/app/api/random-test/availability/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(200)
    expect(res.status).not.toBe(503)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.availableQuestions).toBe(75)
  })

  it('cache vacío + BD timeout → 503 retryable', async () => {
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      const DbTimeoutError = actual.DbTimeoutError
      return { ...actual, withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(12000)) }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: jest.fn(),
    }))
    jest.doMock('@/lib/api/random-test/queries', () => ({
      checkQuestionAvailability: jest.fn(),
    }))

    const { POST } = require('@/app/api/random-test/availability/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(res.headers.get('retry-after')).toBe('300')
  })

  it('cache vacío + BD OK → 200 + setCached', async () => {
    const fresh = sampleAvailability(50)
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return { ...actual, withDbTimeout: jest.fn().mockResolvedValue(fresh) }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
    }))
    jest.doMock('@/lib/api/random-test/queries', () => ({
      checkQuestionAvailability: jest.fn(),
    }))

    const { POST } = require('@/app/api/random-test/availability/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.availableQuestions).toBe(50)
    expect(setCachedFn).toHaveBeenCalledTimes(1)
  })

  it('validación schema falla → 400, no toca BD ni cache', async () => {
    const cacheFn = jest.fn()
    const dbFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return { ...actual, withDbTimeout: dbFn }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: cacheFn,
      setCached: jest.fn(),
    }))
    jest.doMock('@/lib/api/random-test/schemas', () => ({
      safeParseCheckAvailability: () => ({
        success: false,
        error: { issues: [{ message: 'falta oposicion' }] },
      }),
    }))
    jest.doMock('@/lib/api/random-test/queries', () => ({
      checkQuestionAvailability: jest.fn(),
    }))

    const { POST } = require('@/app/api/random-test/availability/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(400)
    expect(dbFn).not.toHaveBeenCalled()
    expect(cacheFn).not.toHaveBeenCalled()
  })

  it('cache key estable bajo permutación de selectedThemes', async () => {
    const setCachedFn = jest.fn()
    const fresh = sampleAvailability(100)
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return { ...actual, withDbTimeout: jest.fn().mockResolvedValue(fresh) }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
    }))
    jest.doMock('@/lib/api/random-test/queries', () => ({
      checkQuestionAvailability: jest.fn(),
    }))

    const { POST } = require('@/app/api/random-test/availability/route')
    await POST(buildPostReq({ selectedThemes: [1, 2, 3] }))
    await POST(buildPostReq({ selectedThemes: [3, 2, 1] }))

    expect(setCachedFn).toHaveBeenCalledTimes(2)
    // Las dos keys deben ser idénticas (orden de array no afecta hash)
    expect(setCachedFn.mock.calls[0][0]).toBe(setCachedFn.mock.calls[1][0])
  })
})
