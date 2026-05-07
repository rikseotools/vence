// __tests__/api/v2/weakArticlesTimeout.test.ts
// Quick-fail wrapper en /api/v2/topic-progress/weak-articles
// (cascade prevention 2026-05-07)

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

const VALID_USER = { id: '550e8400-e29b-41d4-a716-446655440000' }

const buildReq = () => ({
  url: 'https://www.vence.es/api/v2/topic-progress/weak-articles?minAttempts=2&maxSuccessRate=60',
  headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? 'Bearer token' : null) },
})

describe('/api/v2/topic-progress/weak-articles — Cascade prevention', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: VALID_USER }, error: null }) },
      }),
    }))
    jest.doMock('@/lib/api/topic-progress', () => ({
      safeParseGetWeakArticles: (p: unknown) => ({ success: true, data: p }),
      getWeakArticlesForUser: jest.fn(),
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
        withDbTimeout: (_fn: () => Promise<unknown>, timeoutMs = 15000) => {
          throw new DbTimeoutError(timeoutMs)
        },
      }
    })

    const { GET } = require('@/app/api/v2/topic-progress/weak-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('5')
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.retryable).toBe(true)
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

    const { GET } = require('@/app/api/v2/topic-progress/weak-articles/route')
    const t0 = Date.now()
    await GET(buildReq())
    expect(Date.now() - t0).toBeLessThan(1000)
  })

  it('happy path: query exitosa devuelve 200', async () => {
    jest.doMock('@/lib/db/timeout', () => ({
      DbTimeoutError: class extends Error {},
      isDbTimeoutError: () => false,
      withDbTimeout: (fn: () => Promise<unknown>) => fn(),
    }))
    jest.doMock('@/lib/api/topic-progress', () => ({
      safeParseGetWeakArticles: (p: unknown) => ({ success: true, data: p }),
      getWeakArticlesForUser: jest.fn().mockResolvedValue({
        success: true,
        weakArticlesByTopic: { 1: [], 2: [] },
      }),
    }))

    const { GET } = require('@/app/api/v2/topic-progress/weak-articles/route')
    const res = await GET(buildReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })
})
