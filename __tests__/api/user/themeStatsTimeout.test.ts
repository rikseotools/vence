// __tests__/api/user/themeStatsTimeout.test.ts
// Quick-fail wrapper en /api/user/theme-stats (cascade prevention 2026-05-07)

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

const buildReq = () => ({
  url: 'https://www.vence.es/api/user/theme-stats?userId=550e8400-e29b-41d4-a716-446655440000',
})

describe('/api/user/theme-stats — Cascade prevention', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.doMock('@/lib/api/theme-stats', () => ({
      VALID_OPOSICIONES: ['auxiliar-administrativo-estado'],
      safeParseGetThemeStatsRequest: (p: unknown) => ({ success: true, data: p }),
      getUserThemeStats: jest.fn(),
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))
  })

  it('timeout → 503 retryable + Retry-After', async () => {
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
        withDbTimeout: () => { throw new DbTimeoutError(15000) },
      }
    })

    const { GET } = require('@/app/api/user/theme-stats/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(503)
    // 300s decidido en commit b09961b4 (10/05/2026): 5s era engañoso; 5 min
    // cubre la mayoría de blips de pool degradado.
    expect(res.headers.get('Retry-After')).toBe('300')
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.retryable).toBe(true)
  })

  it('happy path: 200 cuando query OK', async () => {
    jest.doMock('@/lib/db/timeout', () => ({
      DbTimeoutError: class extends Error {},
      isDbTimeoutError: () => false,
      withDbTimeout: (fn: () => Promise<unknown>) => fn(),
    }))
    jest.doMock('@/lib/api/theme-stats', () => ({
      VALID_OPOSICIONES: ['auxiliar-administrativo-estado'],
      safeParseGetThemeStatsRequest: (p: unknown) => ({ success: true, data: p }),
      getUserThemeStats: jest.fn().mockResolvedValue({ success: true, stats: [] }),
    }))

    const { GET } = require('@/app/api/user/theme-stats/route')
    const res = await GET(buildReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('regresión: timeout no espera maxDuration completo', async () => {
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
        withDbTimeout: () => { throw new DbTimeoutError(15000) },
      }
    })

    const { GET } = require('@/app/api/user/theme-stats/route')
    const t0 = Date.now()
    await GET(buildReq())
    expect(Date.now() - t0).toBeLessThan(1000)
  })
})
