// __tests__/api/notifications/problematicArticlesStaleWhileError.test.ts
// Tests del patrón stale-while-error en /api/notifications/problematic-articles
// (refactor 2026-05-07): garantizar que un blip de pool nunca devuelve 503.

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

const buildReq = () => ({})

const sample = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    article_id: `art-${i}`,
    article_number: String(i + 1),
    law_name: 'LAW',
    total_attempts: 10,
    correct_attempts: 5,
    accuracy_percentage: 50,
    last_attempt_date: null,
    recommendation: '📖 Repasar conceptos',
  }))

describe('/api/notifications/problematic-articles — stale-while-error', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.doMock('@/lib/api/shared/auth', () => ({
      getAuthenticatedUser: jest.fn().mockResolvedValue({
        ok: true,
        user: { id: VALID_USER_ID },
      }),
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))
    jest.doMock('@/lib/api/oposicion-scope/queries', () => ({
      getAllowedLawIds: jest.fn().mockResolvedValue({ positionType: 'auxiliar', lawIds: ['l1'], lawShortNames: ['LAW'] }),
    }))
    jest.doMock('@/lib/api/rollout/problematic-articles-logs', () => ({
      logRolloutEvent: jest.fn(),
    }))
  })

  it('cache fresco (<5min) → 200, datos del cache, BD NO se llama', async () => {
    const queryFn = jest.fn()
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/api/notifications/queries', () => ({
      getUserProblematicArticlesWeekly: queryFn,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({ data: sample(3), ts: Date.now() - 60_000 }), // 60s
      setCached: setCachedFn,
    }))

    const { GET } = require('@/app/api/notifications/problematic-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.articles).toHaveLength(3)
    expect(queryFn).not.toHaveBeenCalled()
    expect(setCachedFn).not.toHaveBeenCalled()
  })

  it('cache stale (>5min) + BD OK → 200 con datos nuevos + cache refresh', async () => {
    const queryFn = jest.fn().mockResolvedValue(sample(2))
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/api/notifications/queries', () => ({
      getUserProblematicArticlesWeekly: queryFn,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({ data: sample(5), ts: Date.now() - 10 * 60_000 }), // 10min
      setCached: setCachedFn,
    }))

    const { GET } = require('@/app/api/notifications/problematic-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.articles).toHaveLength(2) // los nuevos
    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(setCachedFn).toHaveBeenCalledTimes(1)
  })

  it('cache stale + BD timeout → 200 con stale (NO 503)', async () => {
    const staleData = sample(7)
    jest.doMock('@/lib/api/notifications/queries', () => ({
      getUserProblematicArticlesWeekly: () => new Promise(() => {}), // pending forever
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({ data: staleData, ts: Date.now() - 10 * 60_000 }),
      setCached: jest.fn(),
    }))

    // Use fake timers to advance through the 10s timeout fast
    jest.useFakeTimers()
    const { GET } = require('@/app/api/notifications/problematic-articles/route')
    const promise = GET(buildReq()).catch((e: unknown) => e)
    await jest.advanceTimersByTimeAsync(10_001)
    const res = await promise
    jest.useRealTimers()

    expect(res.status).toBe(200)
    expect(res.status).not.toBe(503)
    const body = await res.json()
    expect(body.articles).toEqual(staleData)
  })

  it('cache vacío + BD timeout → 200 con [] (NO 503)', async () => {
    jest.doMock('@/lib/api/notifications/queries', () => ({
      getUserProblematicArticlesWeekly: () => new Promise(() => {}),
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: jest.fn(),
    }))

    jest.useFakeTimers()
    const { GET } = require('@/app/api/notifications/problematic-articles/route')
    const promise = GET(buildReq()).catch((e: unknown) => e)
    await jest.advanceTimersByTimeAsync(10_001)
    const res = await promise
    jest.useRealTimers()

    expect(res.status).toBe(200)
    expect(res.status).not.toBe(503)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.articles).toEqual([])
  })

  it('cache vacío + BD OK → 200 con datos + setCached', async () => {
    const articles = sample(4)
    const queryFn = jest.fn().mockResolvedValue(articles)
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/api/notifications/queries', () => ({
      getUserProblematicArticlesWeekly: queryFn,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
    }))

    const { GET } = require('@/app/api/notifications/problematic-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.articles).toEqual(articles)
    expect(setCachedFn).toHaveBeenCalledWith(
      `problematic_articles:${VALID_USER_ID}`,
      expect.objectContaining({ data: articles }),
      expect.any(Number),
    )
  })

  it('error de BD (no timeout) + cache stale → 200 con stale', async () => {
    const staleData = sample(2)
    jest.doMock('@/lib/api/notifications/queries', () => ({
      getUserProblematicArticlesWeekly: jest.fn().mockRejectedValue(new Error('connection refused')),
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({ data: staleData, ts: Date.now() - 10 * 60_000 }),
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/notifications/problematic-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.articles).toEqual(staleData)
  })

  it('auth fail → 401, no toca cache ni BD', async () => {
    const queryFn = jest.fn()
    const getCachedFn = jest.fn()
    jest.doMock('@/lib/api/shared/auth', () => ({
      getAuthenticatedUser: jest.fn().mockResolvedValue({
        ok: false,
        response: { status: 401, json: async () => ({ error: 'unauth' }) },
      }),
    }))
    jest.doMock('@/lib/api/notifications/queries', () => ({
      getUserProblematicArticlesWeekly: queryFn,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: getCachedFn,
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/notifications/problematic-articles/route')
    const res = await GET(buildReq())

    expect(res.status).toBe(401)
    expect(queryFn).not.toHaveBeenCalled()
    expect(getCachedFn).not.toHaveBeenCalled()
  })
})
