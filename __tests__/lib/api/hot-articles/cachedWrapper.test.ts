// __tests__/lib/api/hot-articles/cachedWrapper.test.ts
// Tests del wrapper cached checkHotArticleCached (Fase 4b).
//
// Garantiza el contrato del feature flag CACHE_HOT_ARTICLES:
//   - undefined o 'true' → usa unstable_cache
//   - 'false'             → bypass al fetcher real (rollback granular)

// ============================================
// MOCKS
// ============================================

const mockCachedFn = jest.fn()
jest.mock('next/cache', () => ({
  unstable_cache: jest.fn((fn: Function) => {
    return (...args: unknown[]) => {
      mockCachedFn(...args)
      return fn(...args)
    }
  }),
}))

const mockSelect = jest.fn().mockReturnValue({
  from: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnValue({
      orderBy: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
      limit: jest.fn().mockResolvedValue([]),
    }),
  }),
})
jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({ select: mockSelect })),
}))

jest.mock('@/db/schema', () => ({
  hotArticles: {
    articleId: 'article_id',
    targetOposicion: 'target_oposicion',
    hotnessScore: 'hotness_score',
    priorityLevel: 'priority_level',
    totalOfficialAppearances: 'total_official_appearances',
  },
  questions: { id: 'id' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  ne: jest.fn((...args: unknown[]) => ({ type: 'ne', args })),
  inArray: jest.fn((...args: unknown[]) => ({ type: 'inArray', args })),
}))

// ============================================
// IMPORTS
// ============================================

import { checkHotArticleCached } from '@/lib/api/hot-articles/queries'

const VALID_REQ = {
  articleId: '00000000-0000-0000-0000-000000000001',
  userOposicion: 'auxiliar_administrativo_estado',
  currentOposicion: 'auxiliar_administrativo_estado',
} as Parameters<typeof checkHotArticleCached>[0]

// ============================================
// TESTS
// ============================================

describe('checkHotArticleCached — feature flag', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    mockCachedFn.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('flag undefined → usa unstable_cache', async () => {
    delete process.env.CACHE_HOT_ARTICLES
    await checkHotArticleCached(VALID_REQ)

    expect(mockCachedFn).toHaveBeenCalledTimes(1)
  })

  test('flag "true" → usa unstable_cache', async () => {
    process.env.CACHE_HOT_ARTICLES = 'true'
    await checkHotArticleCached(VALID_REQ)

    expect(mockCachedFn).toHaveBeenCalledTimes(1)
  })

  test('flag "false" → bypass al fetcher real, NO unstable_cache', async () => {
    process.env.CACHE_HOT_ARTICLES = 'false'
    await checkHotArticleCached(VALID_REQ)

    expect(mockCachedFn).not.toHaveBeenCalled()
  })

  test('llamadas con params iguales no rompen — la dedupe la hace unstable_cache', async () => {
    delete process.env.CACHE_HOT_ARTICLES
    await checkHotArticleCached(VALID_REQ)
    await checkHotArticleCached(VALID_REQ)
    await checkHotArticleCached(VALID_REQ)

    expect(mockCachedFn).toHaveBeenCalledTimes(3)
  })

  test('cache key incluye los 3 params (articleId, userOposicion, currentOposicion)', async () => {
    delete process.env.CACHE_HOT_ARTICLES

    await checkHotArticleCached({
      articleId: 'a-1',
      userOposicion: 'a',
      currentOposicion: 'a',
    } as Parameters<typeof checkHotArticleCached>[0])

    await checkHotArticleCached({
      articleId: 'a-1',
      userOposicion: 'a',
      currentOposicion: 'b', // ← currentOposicion distinto
    } as Parameters<typeof checkHotArticleCached>[0])

    // Ambas llaman al wrapper unstable_cache (la dedupe interna depende de
    // unstable_cache key-by-args; el test solo verifica que NO se hace
    // bypass por error con params distintos).
    expect(mockCachedFn).toHaveBeenCalledTimes(2)
    expect(mockCachedFn).toHaveBeenNthCalledWith(1, {
      articleId: 'a-1',
      userOposicion: 'a',
      currentOposicion: 'a',
    })
    expect(mockCachedFn).toHaveBeenNthCalledWith(2, {
      articleId: 'a-1',
      userOposicion: 'a',
      currentOposicion: 'b',
    })
  })
})
