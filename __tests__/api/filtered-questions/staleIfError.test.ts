// __tests__/api/filtered-questions/staleIfError.test.ts
// Tests del patrón stale-if-error en /api/questions/filtered (refactor 2026-05-09).
//
// Garantiza que un blip del pooler regional no devuelva 503 si hay cache.
// A diferencia de weak-articles, este endpoint NO tiene fast-path de cache
// fresco (cada POST debe ir a BD para preservar aleatoriedad de selección).

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

const sampleQuestions = (n = 3) => Array.from({ length: n }, (_, i) => ({
  id: `q-${i + 1}`,
  question: `Q${i + 1}`,
  options: ['A', 'B', 'C', 'D'],
  explanation: 'exp',
  correct_option: 0,
  primary_article_id: `a-${i + 1}`,
  tema: 1,
  article: {
    id: `a-${i + 1}`,
    number: '1',
    title: 'T',
    full_text: 'F',
    law_name: 'CE',
    law_short_name: 'CE',
    display_number: 'Art. 1 CE',
  },
  metadata: {
    id: `q-${i + 1}`,
    difficulty: 'medium',
    question_type: 'single',
    tags: null,
    is_active: true,
    created_at: null,
    updated_at: null,
    is_official_exam: false,
    exam_source: null,
    exam_date: null,
    exam_entity: null,
    exam_position: null,
    official_difficulty_level: null,
  },
}))

const buildPostReq = (body: Record<string, unknown> = {}) => ({
  url: 'https://www.vence.es/api/questions/filtered',
  headers: {
    get: (k: string) => {
      const map: Record<string, string> = {
        authorization: 'Bearer fake-token',
        'user-agent': 'jest',
        'x-forwarded-for': '127.0.0.1',
      }
      return map[k.toLowerCase()] ?? null
    },
  },
  json: async () => ({
    topicNumber: 1,
    positionType: 'auxiliar_administrativo_estado',
    selectedLaws: ['CE'],
    numQuestions: 25,
    ...body,
  }),
})

const buildGetCountReq = (query: Record<string, string> = {}) => {
  const sp = new URLSearchParams({
    action: 'count',
    topicNumber: '1',
    positionType: 'auxiliar_administrativo_estado',
    ...query,
  })
  return {
    url: `https://www.vence.es/api/questions/filtered?${sp.toString()}`,
    headers: {
      get: (k: string) => (k.toLowerCase() === 'user-agent' ? 'jest' : null),
    },
  }
}

describe('/api/questions/filtered POST — stale-if-error', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: () => ({
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: VALID_USER_ID } }, error: null }),
        },
      }),
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))
    jest.doMock('@/lib/api/rateLimit', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, resetMs: 0 }),
      getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
      RATE_LIMIT_QUESTIONS: { maxRequests: 60, windowMs: 60000 },
    }))
    jest.doMock('@/lib/api/validation-error-log', () => ({
      logValidationError: jest.fn(),
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

  it('éxito + preguntas → cachea la respuesta y la devuelve', async () => {
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return {
        ...actual,
        withDbTimeout: jest.fn().mockResolvedValue({
          success: true,
          questions: sampleQuestions(3),
          totalAvailable: 3,
          filtersApplied: { laws: 1, articles: 0, sections: 0 },
        }),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
    }))

    const { POST } = require('@/app/api/questions/filtered/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.questions).toHaveLength(3)
    // Doble cache: per-user + global (commit 06822135 — mejora cobertura stale-fallback)
    expect(setCachedFn).toHaveBeenCalledTimes(2)
    const keys = setCachedFn.mock.calls.map(c => c[0])
    expect(keys.some((k: string) => k.startsWith(`filtered_q:${VALID_USER_ID}:`))).toBe(true)
    expect(keys.some((k: string) => k.startsWith('filtered_q:any:'))).toBe(true)
    expect(setCachedFn.mock.calls[0][2]).toBe(600) // 10 min TTL
  })

  it('éxito + 0 preguntas → NO cachea (no perpetuamos vacíos transitorios)', async () => {
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return {
        ...actual,
        withDbTimeout: jest.fn().mockResolvedValue({
          success: true,
          questions: [],
          totalAvailable: 0,
          filtersApplied: { laws: 1, articles: 0, sections: 0 },
        }),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
    }))

    const { POST } = require('@/app/api/questions/filtered/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(200)
    expect(setCachedFn).not.toHaveBeenCalled()
  })

  it('timeout + cache stale presente → 200 con stale (NO 503)', async () => {
    const staleResponse = {
      success: true,
      questions: sampleQuestions(5),
      totalAvailable: 5,
      filtersApplied: { laws: 1, articles: 0, sections: 0 },
    }
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      const DbTimeoutError = actual.DbTimeoutError
      return {
        ...actual,
        withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(15000)),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: staleResponse,
        ts: Date.now() - 5 * 60_000, // 5 min de antigüedad
      }),
      setCached: jest.fn(),
    }))

    const { POST } = require('@/app/api/questions/filtered/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(200)
    expect(res.status).not.toBe(503)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.questions).toHaveLength(5)
  })

  it('timeout + cache vacío → 503 retryable (comportamiento histórico)', async () => {
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      const DbTimeoutError = actual.DbTimeoutError
      return {
        ...actual,
        withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(15000)),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: jest.fn(),
    }))

    const { POST } = require('@/app/api/questions/filtered/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.retryable).toBe(true)
    // Retry-After 300 (5 min) — commit b09961b4 cambió valor de 5s a 5min
    // tras feedback "5s era engañoso, los blips duran 30s-2min"
    expect(res.headers.get('retry-after')).toBe('300')
  })

  it('timeout + cache stale pero con questions=[] → 503 (no servir vacíos)', async () => {
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      const DbTimeoutError = actual.DbTimeoutError
      return {
        ...actual,
        withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(15000)),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: { success: true, questions: [], totalAvailable: 0 },
        ts: Date.now() - 60_000,
      }),
      setCached: jest.fn(),
    }))

    const { POST } = require('@/app/api/questions/filtered/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(503)
  })

  it('rate limit excedido → 429, NO toca BD ni cache', async () => {
    const checkRateLimitMock = jest.fn().mockReturnValue({ allowed: false, resetMs: 60000 })
    const withDbTimeoutMock = jest.fn()
    const getCachedMock = jest.fn()
    jest.doMock('@/lib/api/rateLimit', () => ({
      checkRateLimit: checkRateLimitMock,
      getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
      RATE_LIMIT_QUESTIONS: { maxRequests: 60, windowMs: 60000 },
    }))
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return { ...actual, withDbTimeout: withDbTimeoutMock }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: getCachedMock,
      setCached: jest.fn(),
    }))

    const { POST } = require('@/app/api/questions/filtered/route')
    const res = await POST(buildPostReq())

    expect(res.status).toBe(429)
    expect(withDbTimeoutMock).not.toHaveBeenCalled()
    expect(getCachedMock).not.toHaveBeenCalled()
  })

  it('cache key cambia cuando cambian los filtros (selectedLaws)', async () => {
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return {
        ...actual,
        withDbTimeout: jest.fn().mockResolvedValue({
          success: true,
          questions: sampleQuestions(2),
          totalAvailable: 2,
          filtersApplied: { laws: 1, articles: 0, sections: 0 },
        }),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
    }))

    const { POST } = require('@/app/api/questions/filtered/route')
    await POST(buildPostReq({ selectedLaws: ['CE'] }))
    await POST(buildPostReq({ selectedLaws: ['Ley 39/2015'] }))

    // Cada POST escribe doble cache (per-user + global) → 4 calls totales para 2 POSTs
    expect(setCachedFn).toHaveBeenCalledTimes(4)
    // Comparar keys per-user (calls 0 y 2) que deben diferir entre las 2 selectedLaws
    const userKey1 = setCachedFn.mock.calls[0][0]
    const userKey2 = setCachedFn.mock.calls[2][0]
    expect(userKey1).not.toBe(userKey2)
  })

  it('cache key estable bajo permutación de selectedLaws (orden no significativo)', async () => {
    const setCachedFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return {
        ...actual,
        withDbTimeout: jest.fn().mockResolvedValue({
          success: true,
          questions: sampleQuestions(2),
          totalAvailable: 2,
          filtersApplied: { laws: 2, articles: 0, sections: 0 },
        }),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: setCachedFn,
    }))

    const { POST } = require('@/app/api/questions/filtered/route')
    await POST(buildPostReq({ selectedLaws: ['CE', 'Ley 39/2015'] }))
    await POST(buildPostReq({ selectedLaws: ['Ley 39/2015', 'CE'] }))

    // Cada POST escribe doble cache (per-user + global) → 4 calls para 2 POSTs
    expect(setCachedFn).toHaveBeenCalledTimes(4)
    // Permutación produce mismo hash → key per-user idéntica
    expect(setCachedFn.mock.calls[0][0]).toBe(setCachedFn.mock.calls[2][0])
  })
})

describe('/api/questions/filtered GET ?action=count — fresh + stale', () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'

    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_path: string, h: Function) => h,
    }))
    jest.doMock('@/lib/api/rateLimit', () => ({
      checkRateLimit: jest.fn().mockReturnValue({ allowed: true, resetMs: 0 }),
      getClientIp: jest.fn().mockReturnValue('127.0.0.1'),
      RATE_LIMIT_QUESTIONS: { maxRequests: 60, windowMs: 60000 },
    }))
    jest.doMock('@/lib/api/validation-error-log', () => ({
      logValidationError: jest.fn(),
    }))
  })

  it('fast-path: cache fresco (<60s) → BD NO se llama', async () => {
    const queryFn = jest.fn()
    jest.doMock('@/lib/db/timeout', () => {
      const actual = jest.requireActual('@/lib/db/timeout')
      return {
        ...actual,
        withDbTimeout: queryFn,
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: { success: true, count: 42, byLaw: { CE: 42 } },
        ts: Date.now() - 5_000,
      }),
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/questions/filtered/route')
    const res = await GET(buildGetCountReq())

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(42)
    expect(queryFn).not.toHaveBeenCalled()
  })

  it('cache stale + BD timeout → 200 con stale (NO 503)', async () => {
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
        withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(8000)),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue({
        data: { success: true, count: 99, byLaw: { CE: 99 } },
        ts: Date.now() - 2 * 60_000, // stale (2 min)
      }),
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/questions/filtered/route')
    const res = await GET(buildGetCountReq())

    expect(res.status).toBe(200)
    expect(res.status).not.toBe(503)
    const body = await res.json()
    expect(body.count).toBe(99)
  })

  it('cache vacío + BD timeout → 503', async () => {
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
        withDbTimeout: jest.fn().mockRejectedValue(new DbTimeoutError(8000)),
      }
    })
    jest.doMock('@/lib/cache/redis', () => ({
      getCached: jest.fn().mockResolvedValue(null),
      setCached: jest.fn(),
    }))

    const { GET } = require('@/app/api/questions/filtered/route')
    const res = await GET(buildGetCountReq())

    expect(res.status).toBe(503)
  })
})
