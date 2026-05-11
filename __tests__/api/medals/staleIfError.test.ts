// __tests__/api/medals/staleIfError.test.ts
// Tests del patrón stale-if-error en /api/medals GET (refactor 2026-05-11).
//
// Garantiza que un blip del pooler regional no devuelva 503 si hay cache.
// Sin fresh fast-path (cada GET sigue yendo a BD para preservar UX de
// medallas frescas tras POST que añade nuevas).

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

const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

const sampleMedalsResponse = () => ({
  success: true as const,
  medals: [
    { id: 'm1', code: 'first-test', earnedAt: '2026-05-01' },
    { id: 'm2', code: 'streak-7', earnedAt: '2026-05-05' },
  ],
})

const buildGetReq = (userId: string = VALID_USER_ID) => ({
  url: `https://www.vence.es/api/medals?userId=${userId}`,
  headers: { get: () => null },
})

const buildPostReq = () => ({
  url: 'https://www.vence.es/api/medals',
  headers: { get: () => null },
  json: async () => ({ userId: VALID_USER_ID }),
})

describe('/api/medals GET — stale-if-error', () => {
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
  })

  it('cache fresco Redis → 200 sin tocar BD', async () => {
    const dbFn = jest.fn()
    const setCachedFn = jest.fn()
    const fresh = sampleMedalsResponse()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return {
        ...actual,
        withDbTimeout: dbFn,
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: fresh,
        ts: Date.now() - 60_000,
      }),
      setCached: setCachedFn,
      invalidate: jest.fn(),
    }))
    jest.doMock('@/lib/api/medals', () => ({
      safeParseGetMedalsRequest: (p: { userId: string }) => ({ success: true, data: { userId: p.userId } }),
      safeParseCheckMedalsRequest: jest.fn(),
      getUserMedals: jest.fn(),
      checkAndSaveNewMedals: jest.fn(),
    }))

    const { GET } = require('@/app/api/medals/route')
    const res = await GET(buildGetReq())

    expect(res.status).toBe(200)
    expect(res.headers.get('x-medals-cache')).toBe('hit')
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.medals).toHaveLength(2)
    expect(dbFn).not.toHaveBeenCalled()
    expect(setCachedFn).not.toHaveBeenCalled()
  })

  it('éxito BD → cachea resultado y devuelve fresco', async () => {
    const setCachedFn = jest.fn()
    const fresh = sampleMedalsResponse()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return {
        ...actual,
        withDbTimeout: jest.fn().mockResolvedValue(fresh),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
      invalidate: jest.fn(),
    }))
    jest.doMock('@/lib/api/medals', () => ({
      safeParseGetMedalsRequest: (p: { userId: string }) => ({ success: true, data: { userId: p.userId } }),
      safeParseCheckMedalsRequest: jest.fn(),
      getUserMedals: jest.fn(),
      checkAndSaveNewMedals: jest.fn(),
    }))

    const { GET } = require('@/app/api/medals/route')
    const res = await GET(buildGetReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.medals).toHaveLength(2)
    expect(setCachedFn).toHaveBeenCalledTimes(1)
    expect(setCachedFn.mock.calls[0][0]).toBe(`medals:${VALID_USER_ID}`)
    expect(setCachedFn.mock.calls[0][2]).toBe(86400) // 24h stale TTL
  })

  it('éxito BD pero result.success=false → NO cachea', async () => {
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return {
        ...actual,
        withDbTimeout: jest.fn().mockResolvedValue({ success: false, error: 'algún error' }),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
      invalidate: jest.fn(),
    }))
    jest.doMock('@/lib/api/medals', () => ({
      safeParseGetMedalsRequest: (p: { userId: string }) => ({ success: true, data: { userId: p.userId } }),
      safeParseCheckMedalsRequest: jest.fn(),
      getUserMedals: jest.fn(),
      checkAndSaveNewMedals: jest.fn(),
    }))

    const { GET } = require('@/app/api/medals/route')
    const res = await GET(buildGetReq())

    expect(res.status).toBe(200)
    expect(setCachedFn).not.toHaveBeenCalled()
  })

  it('timeout BD + cache stale presente → 200 con stale (NO 503)', async () => {
    const staleResponse = sampleMedalsResponse()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      const DbTimeoutError = actual.DbTimeoutError
      return {
        ...actual,
        withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(8000)),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: staleResponse,
        ts: Date.now() - 10 * 60_000, // 10 min de antigüedad
      }),
      setCached: jest.fn(),
      invalidate: jest.fn(),
    }))
    jest.doMock('@/lib/api/medals', () => ({
      safeParseGetMedalsRequest: (p: { userId: string }) => ({ success: true, data: { userId: p.userId } }),
      safeParseCheckMedalsRequest: jest.fn(),
      getUserMedals: jest.fn(),
      checkAndSaveNewMedals: jest.fn(),
    }))

    const { GET } = require('@/app/api/medals/route')
    const res = await GET(buildGetReq())

    expect(res.status).toBe(200)
    expect(res.status).not.toBe(503)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.medals).toHaveLength(2)
  })

  it('timeout BD + cache vacío → 503 retryable', async () => {
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      const DbTimeoutError = actual.DbTimeoutError
      return {
        ...actual,
        withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(8000)),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: jest.fn(),
      invalidate: jest.fn(),
    }))
    jest.doMock('@/lib/api/medals', () => ({
      safeParseGetMedalsRequest: (p: { userId: string }) => ({ success: true, data: { userId: p.userId } }),
      safeParseCheckMedalsRequest: jest.fn(),
      getUserMedals: jest.fn(),
      checkAndSaveNewMedals: jest.fn(),
    }))

    const { GET } = require('@/app/api/medals/route')
    const res = await GET(buildGetReq())

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.retryable).toBe(true)
  })

  it('timeout BD + cache stale con success=false → 503 (no servir errores stale)', async () => {
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      const DbTimeoutError = actual.DbTimeoutError
      return {
        ...actual,
        withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(8000)),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: { success: false, error: 'error viejo' },
        ts: Date.now() - 60_000,
      }),
      setCached: jest.fn(),
      invalidate: jest.fn(),
    }))
    jest.doMock('@/lib/api/medals', () => ({
      safeParseGetMedalsRequest: (p: { userId: string }) => ({ success: true, data: { userId: p.userId } }),
      safeParseCheckMedalsRequest: jest.fn(),
      getUserMedals: jest.fn(),
      checkAndSaveNewMedals: jest.fn(),
    }))

    const { GET } = require('@/app/api/medals/route')
    const res = await GET(buildGetReq())

    expect(res.status).toBe(503)
  })

  it('userId inválido → 400, no toca BD ni cache', async () => {
    const dbFn = jest.fn()
    const cacheFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return { ...actual, withDbTimeout: dbFn }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: cacheFn,
      setCached: jest.fn(),
      invalidate: jest.fn(),
    }))
    jest.doMock('@/lib/api/medals', () => ({
      safeParseGetMedalsRequest: () => ({ success: false, error: { issues: [] } }),
      safeParseCheckMedalsRequest: jest.fn(),
      getUserMedals: jest.fn(),
      checkAndSaveNewMedals: jest.fn(),
    }))

    const { GET } = require('@/app/api/medals/route')
    const res = await GET(buildGetReq('invalido'))

    expect(res.status).toBe(400)
    expect(dbFn).not.toHaveBeenCalled()
    expect(cacheFn).not.toHaveBeenCalled()
  })
})

describe('/api/medals POST — invalida cache tras éxito', () => {
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
  })

  it('POST éxito → invalida cache del user (write-through)', async () => {
    const invalidateFn = jest.fn().mockResolvedValue(undefined)
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return {
        ...actual,
        withDbTimeout: jest.fn().mockResolvedValue({ success: true, newMedalsCount: 1 }),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn(),
      setCached: jest.fn(),
      invalidate: invalidateFn,
    }))
    jest.doMock('@/lib/api/medals', () => ({
      safeParseGetMedalsRequest: jest.fn(),
      safeParseCheckMedalsRequest: (p: { userId: string }) => ({ success: true, data: { userId: p.userId } }),
      getUserMedals: jest.fn(),
      checkAndSaveNewMedals: jest.fn(),
    }))

    const { POST } = require('@/app/api/medals/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(200)
    expect(invalidateFn).toHaveBeenCalledTimes(1)
    expect(invalidateFn).toHaveBeenCalledWith(`medals:${VALID_USER_ID}`)
  })

  it('POST con result.success=false → NO invalida (no había cambio que justifique)', async () => {
    const invalidateFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return {
        ...actual,
        withDbTimeout: jest.fn().mockResolvedValue({ success: false, error: 'algún error' }),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn(),
      setCached: jest.fn(),
      invalidate: invalidateFn,
    }))
    jest.doMock('@/lib/api/medals', () => ({
      safeParseGetMedalsRequest: jest.fn(),
      safeParseCheckMedalsRequest: (p: { userId: string }) => ({ success: true, data: { userId: p.userId } }),
      getUserMedals: jest.fn(),
      checkAndSaveNewMedals: jest.fn(),
    }))

    const { POST } = require('@/app/api/medals/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(200)
    expect(invalidateFn).not.toHaveBeenCalled()
  })

  it('POST con timeout → 503 retryable, no invalida', async () => {
    const invalidateFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      const DbTimeoutError = actual.DbTimeoutError
      return {
        ...actual,
        withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(15000)),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn(),
      setCached: jest.fn(),
      invalidate: invalidateFn,
    }))
    jest.doMock('@/lib/api/medals', () => ({
      safeParseGetMedalsRequest: jest.fn(),
      safeParseCheckMedalsRequest: (p: { userId: string }) => ({ success: true, data: { userId: p.userId } }),
      getUserMedals: jest.fn(),
      checkAndSaveNewMedals: jest.fn(),
    }))

    const { POST } = require('@/app/api/medals/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(503)
    expect(invalidateFn).not.toHaveBeenCalled()
  })
})
