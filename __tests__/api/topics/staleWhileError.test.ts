// __tests__/api/topics/staleWhileError.test.ts
// Tests del patrón stale-while-error en /api/topics/[numero]
// (refactor 2026-05-08): elimina 503 user-facing en blips de pool cuando
// hay cache previo. Sin cache + blip sigue devolviendo 503 (comportamiento
// histórico, fuera del scope de este fix).

// Marca como módulo para evitar colisión global con otros test files
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
const VALID_OPOSICION = 'auxiliar-administrativo-estado'

const sampleResponse = (totalQuestions = 100): Record<string, unknown> => ({
  success: true,
  topic: {
    id: 't-1',
    topicNumber: 109,
    title: 'Hojas de cálculo: Excel',
    description: null,
    difficulty: null,
    estimatedHours: null,
  },
  difficultyStats: { easy: 25, medium: 50, hard: 20, extreme: 5, auto: 0 },
  totalQuestions,
  officialQuestionsCount: 30,
  articlesByLaw: [],
  userProgress: null,
  generatedAt: new Date().toISOString(),
})

const buildReq = () => ({
  nextUrl: {
    searchParams: new Map<string, string>([
      ['oposicion', VALID_OPOSICION],
      ['userId', VALID_USER_ID],
    ]),
  } as unknown as URL,
})

const buildParams = () => ({ params: Promise.resolve({ numero: '109' }) })

// nextUrl.searchParams es Map en jest mock; el route usa .get(name)
// Map.get(key) ya devuelve el valor → compatible.

describe('/api/topics/[numero] — stale-while-error', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))
    jest.doMock('@/lib/config/oposiciones', () => ({
      ALL_OPOSICION_SLUGS: [VALID_OPOSICION],
    }))
    jest.doMock('@/lib/api/topic-data', () => ({
      getTopicFullData: jest.fn(),
      safeParseGetTopicDataRequest: (p: unknown) => ({ success: true, data: p }),
      isValidTopicNumber: () => true,
    }))
  })

  it('cache fresco (<5min) → 200, datos del cache, BD NO se llama', async () => {
    const queryFn = jest.fn()
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/api/topic-data', () => ({
      getTopicFullData: queryFn,
      safeParseGetTopicDataRequest: (p: unknown) => ({ success: true, data: p }),
      isValidTopicNumber: () => true,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({ data: sampleResponse(50), ts: Date.now() - 60_000 }),
      setCached: setCachedFn,
    }))
    jest.doMock('@/lib/db/timeout', () => ({
      withDbTimeout: (fn: () => Promise<unknown>) => fn(),
      isDbTimeoutError: () => false,
      DbTimeoutError: class extends Error {},
    }))

    const { GET } = require('@/app/api/topics/[numero]/route')
    const res = await GET(buildReq(), buildParams())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.totalQuestions).toBe(50)
    expect(queryFn).not.toHaveBeenCalled()
    expect(setCachedFn).not.toHaveBeenCalled()
  })

  it('cache stale (>5min) + BD OK → 200 con datos nuevos + cache refresh', async () => {
    const fresh = sampleResponse(200)
    const queryFn = jest.fn().mockResolvedValue(fresh)
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/api/topic-data', () => ({
      getTopicFullData: queryFn,
      safeParseGetTopicDataRequest: (p: unknown) => ({ success: true, data: p }),
      isValidTopicNumber: () => true,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({ data: sampleResponse(50), ts: Date.now() - 10 * 60_000 }),
      setCached: setCachedFn,
    }))
    jest.doMock('@/lib/db/timeout', () => ({
      withDbTimeout: (fn: () => Promise<unknown>) => fn(),
      isDbTimeoutError: () => false,
      DbTimeoutError: class extends Error {},
    }))

    const { GET } = require('@/app/api/topics/[numero]/route')
    const res = await GET(buildReq(), buildParams())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalQuestions).toBe(200) // los nuevos
    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(setCachedFn).toHaveBeenCalledTimes(1)
  })

  it('cache stale + BD timeout → 200 con stale (NO 503)', async () => {
    const staleData = sampleResponse(7)

    class FakeTimeoutError extends Error {
      readonly name = 'DbTimeoutError'
      readonly timeoutMs = 12000
      constructor() { super('timeout') }
    }
    jest.doMock('@/lib/db/timeout', () => ({
      withDbTimeout: () => { throw new FakeTimeoutError() },
      isDbTimeoutError: (e: unknown) => e instanceof Error && (e as Error).name === 'DbTimeoutError',
      DbTimeoutError: FakeTimeoutError,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({ data: staleData, ts: Date.now() - 10 * 60_000 }),
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/topics/[numero]/route')
    const res = await GET(buildReq(), buildParams())

    expect(res.status).toBe(200)
    expect(res.status).not.toBe(503)
    const body = await res.json()
    expect(body.totalQuestions).toBe(7)
    expect(body.success).toBe(true)
  })

  it('cache vacío + BD timeout → 503 retryable (UNCHANGED del comportamiento original)', async () => {
    class FakeTimeoutError extends Error {
      readonly name = 'DbTimeoutError'
      readonly timeoutMs = 12000
      constructor() { super('timeout') }
    }
    jest.doMock('@/lib/db/timeout', () => ({
      withDbTimeout: () => { throw new FakeTimeoutError() },
      isDbTimeoutError: (e: unknown) => e instanceof Error && (e as Error).name === 'DbTimeoutError',
      DbTimeoutError: FakeTimeoutError,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/topics/[numero]/route')
    const res = await GET(buildReq(), buildParams())

    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('5')
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.retryable).toBe(true)
  })

  it('cache vacío + BD OK → 200 con datos + setCached', async () => {
    const fresh = sampleResponse(123)
    const queryFn = jest.fn().mockResolvedValue(fresh)
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/api/topic-data', () => ({
      getTopicFullData: queryFn,
      safeParseGetTopicDataRequest: (p: unknown) => ({ success: true, data: p }),
      isValidTopicNumber: () => true,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
    }))
    jest.doMock('@/lib/db/timeout', () => ({
      withDbTimeout: (fn: () => Promise<unknown>) => fn(),
      isDbTimeoutError: () => false,
      DbTimeoutError: class extends Error {},
    }))

    const { GET } = require('@/app/api/topics/[numero]/route')
    const res = await GET(buildReq(), buildParams())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalQuestions).toBe(123)
    expect(setCachedFn).toHaveBeenCalledWith(
      `topic_data:${VALID_OPOSICION}:109:${VALID_USER_ID}`,
      expect.objectContaining({ data: fresh }),
      expect.any(Number),
    )
  })

  it('topic no encontrado (success=false) → 404, NO cachea, NO usa stale', async () => {
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/api/topic-data', () => ({
      getTopicFullData: jest.fn().mockResolvedValue({ success: false, error: 'Tema no encontrado' }),
      safeParseGetTopicDataRequest: (p: unknown) => ({ success: true, data: p }),
      isValidTopicNumber: () => true,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({ data: sampleResponse(99), ts: Date.now() - 10 * 60_000 }),
      setCached: setCachedFn,
    }))
    jest.doMock('@/lib/db/timeout', () => ({
      withDbTimeout: (fn: () => Promise<unknown>) => fn(),
      isDbTimeoutError: () => false,
      DbTimeoutError: class extends Error {},
    }))

    const { GET } = require('@/app/api/topics/[numero]/route')
    const res = await GET(buildReq(), buildParams())

    expect(res.status).toBe(404)
    expect(setCachedFn).not.toHaveBeenCalled()
  })

  it('cache key incluye userId — anon vs authenticated NO comparten', async () => {
    const getCachedFn = jest.fn().mockResolvedValue(null)
    jest.doMock('@/lib/api/topic-data', () => ({
      getTopicFullData: jest.fn().mockResolvedValue(sampleResponse(1)),
      safeParseGetTopicDataRequest: (p: unknown) => ({ success: true, data: p }),
      isValidTopicNumber: () => true,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: getCachedFn,
      setCached: jest.fn(),
    }))
    jest.doMock('@/lib/db/timeout', () => ({
      withDbTimeout: (fn: () => Promise<unknown>) => fn(),
      isDbTimeoutError: () => false,
      DbTimeoutError: class extends Error {},
    }))

    const { GET } = require('@/app/api/topics/[numero]/route')

    // User auth
    await GET(buildReq(), buildParams())
    // Anon (sin userId)
    const anonReq = {
      nextUrl: {
        searchParams: new Map<string, string>([['oposicion', VALID_OPOSICION]]),
      },
    }
    await GET(anonReq, buildParams())

    expect(getCachedFn).toHaveBeenCalledTimes(2)
    expect(getCachedFn).toHaveBeenNthCalledWith(1, `topic_data:${VALID_OPOSICION}:109:${VALID_USER_ID}`)
    expect(getCachedFn).toHaveBeenNthCalledWith(2, `topic_data:${VALID_OPOSICION}:109:anon`)
  })

  it('cache stale con success=false — NO se devuelve, falla a 503', async () => {
    // Si por algún motivo se cacheó un { success: false }, no servirlo como stale
    class FakeTimeoutError extends Error {
      readonly name = 'DbTimeoutError'
      readonly timeoutMs = 12000
      constructor() { super('timeout') }
    }
    jest.doMock('@/lib/db/timeout', () => ({
      withDbTimeout: () => { throw new FakeTimeoutError() },
      isDbTimeoutError: (e: unknown) => e instanceof Error && (e as Error).name === 'DbTimeoutError',
      DbTimeoutError: FakeTimeoutError,
    }))
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: { success: false, error: 'algo' },
        ts: Date.now() - 10 * 60_000,
      }),
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/topics/[numero]/route')
    const res = await GET(buildReq(), buildParams())

    expect(res.status).toBe(503)
  })
})
