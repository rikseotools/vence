// __tests__/api/v2/weakArticlesTimeout.test.ts
// Tests del patrón stale-while-error en /api/v2/topic-progress/weak-articles
// (refactor 2026-05-09): garantizar que un blip del pooler regional nunca
// devuelve 503 en este endpoint.

// Marca como módulo
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

const sampleResponse = (numTopics = 2): Record<string, Record<string, unknown>> => {
  const topics: Record<string, Record<string, unknown>> = {}
  for (let i = 1; i <= numTopics; i++) {
    topics[String(i)] = { topic: i, articles: [{ id: `art-${i}`, total: 5, correct: 1 }] }
  }
  return topics
}

const buildReq = () => ({
  url: 'https://www.vence.es/api/v2/topic-progress/weak-articles?minAttempts=2&maxSuccessRate=60',
  headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? 'Bearer fake-token' : null) },
})

describe('/api/v2/topic-progress/weak-articles — stale-while-error', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null }) },
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

  it('cache fresco (<5min) → 200 desde cache, BD NO se llama', async () => {
    const queryFn = jest.fn()
    jest.doMock('@/lib/api/topic-progress', () => ({
      safeParseGetWeakArticles: (p: unknown) => ({ success: true, data: p }),
      getWeakArticlesForUser: queryFn,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: { success: true, weakArticlesByTopic: sampleResponse(3) },
        ts: Date.now() - 60_000,  // 1 min de antigüedad
      }),
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/v2/topic-progress/weak-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Object.keys(body.weakArticlesByTopic)).toHaveLength(3)
    expect(queryFn).not.toHaveBeenCalled()
  })

  it('cache stale + BD OK → 200 con datos nuevos + refresh cache', async () => {
    const fresh = sampleResponse(5)
    const queryFn = jest.fn().mockResolvedValue({ success: true, weakArticlesByTopic: fresh })
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/api/topic-progress', () => ({
      safeParseGetWeakArticles: (p: unknown) => ({ success: true, data: p }),
      getWeakArticlesForUser: queryFn,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: { success: true, weakArticlesByTopic: sampleResponse(2) },
        ts: Date.now() - 10 * 60_000,  // 10 min stale
      }),
      setCached: setCachedFn,
    }))

    const { GET } = require('@/app/api/v2/topic-progress/weak-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body.weakArticlesByTopic)).toHaveLength(5)
    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(setCachedFn).toHaveBeenCalledTimes(1)
  })

  it('cache stale + BD timeout → 200 con stale (NO 503)', async () => {
    const staleData = sampleResponse(7)
    jest.doMock('@/lib/api/topic-progress', () => ({
      safeParseGetWeakArticles: (p: unknown) => ({ success: true, data: p }),
      getWeakArticlesForUser: () => new Promise(() => {}), // pending forever
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: { success: true, weakArticlesByTopic: staleData },
        ts: Date.now() - 10 * 60_000,
      }),
      setCached: jest.fn(),
    }))

    jest.useFakeTimers()
    const { GET } = require('@/app/api/v2/topic-progress/weak-articles/route')
    const promise = GET(buildReq()).catch((e: unknown) => e)
    await jest.advanceTimersByTimeAsync(15_001)
    const res = await promise
    jest.useRealTimers()

    expect(res.status).toBe(200)
    expect(res.status).not.toBe(503)
    const body = await res.json()
    expect(Object.keys(body.weakArticlesByTopic)).toHaveLength(7)
  })

  it('cache vacío + BD timeout → 200 con weakArticlesByTopic={} (NO 503)', async () => {
    jest.doMock('@/lib/api/topic-progress', () => ({
      safeParseGetWeakArticles: (p: unknown) => ({ success: true, data: p }),
      getWeakArticlesForUser: () => new Promise(() => {}),
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: jest.fn(),
    }))

    jest.useFakeTimers()
    const { GET } = require('@/app/api/v2/topic-progress/weak-articles/route')
    const promise = GET(buildReq()).catch((e: unknown) => e)
    await jest.advanceTimersByTimeAsync(15_001)
    const res = await promise
    jest.useRealTimers()

    expect(res.status).toBe(200)
    expect(res.status).not.toBe(503)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.weakArticlesByTopic).toEqual({})
  })

  it('error BD (no timeout) + cache stale → 200 con stale', async () => {
    const staleData = sampleResponse(2)
    jest.doMock('@/lib/api/topic-progress', () => ({
      safeParseGetWeakArticles: (p: unknown) => ({ success: true, data: p }),
      getWeakArticlesForUser: jest.fn().mockRejectedValue(new Error('connection refused')),
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: { success: true, weakArticlesByTopic: staleData },
        ts: Date.now() - 10 * 60_000,
      }),
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/v2/topic-progress/weak-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body.weakArticlesByTopic)).toHaveLength(2)
  })

  it('cache vacío + BD OK → 200 con datos + setCached', async () => {
    const fresh = sampleResponse(4)
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/api/topic-progress', () => ({
      safeParseGetWeakArticles: (p: unknown) => ({ success: true, data: p }),
      getWeakArticlesForUser: jest.fn().mockResolvedValue({ success: true, weakArticlesByTopic: fresh }),
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
    }))

    const { GET } = require('@/app/api/v2/topic-progress/weak-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body.weakArticlesByTopic)).toHaveLength(4)
    expect(setCachedFn).toHaveBeenCalledWith(
      expect.stringContaining(`weak_articles:${VALID_USER_ID}`),
      expect.objectContaining({ data: expect.objectContaining({ weakArticlesByTopic: fresh }) }),
      expect.any(Number),
    )
  })

  it('auth fail → 401, NO toca cache ni BD', async () => {
    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: { getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } }) },
      }),
    }))
    const queryFn = jest.fn()
    const getCachedFn = jest.fn()
    jest.doMock('@/lib/api/topic-progress', () => ({
      safeParseGetWeakArticles: (p: unknown) => ({ success: true, data: p }),
      getWeakArticlesForUser: queryFn,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: getCachedFn,
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/v2/topic-progress/weak-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(401)
    expect(queryFn).not.toHaveBeenCalled()
    expect(getCachedFn).not.toHaveBeenCalled()
  })
})
