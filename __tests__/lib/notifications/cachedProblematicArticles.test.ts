// __tests__/lib/notifications/cachedProblematicArticles.test.ts
// Tests del wrapper cached para getUserProblematicArticlesWeekly (2026-05-07).
// Garantiza el contrato del feature flag CACHE_PROBLEMATIC_ARTICLES.

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
    innerJoin: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockReturnValue({
              having: jest.fn().mockReturnValue({
                orderBy: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  }),
})

jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({ select: mockSelect })),
}))

jest.mock('@/db/schema', () => ({
  articles: { id: 'id', articleNumber: 'article_number', lawId: 'law_id' },
  laws: { id: 'id', shortName: 'short_name' },
  testQuestions: { articleId: 'article_id', isCorrect: 'is_correct', userId: 'user_id', testId: 'test_id', createdAt: 'created_at' },
  tests: { id: 'id', isCompleted: 'is_completed' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  gte: jest.fn((...args: unknown[]) => ({ type: 'gte', args })),
  inArray: jest.fn((...args: unknown[]) => ({ type: 'inArray', args })),
  isNotNull: jest.fn((...args: unknown[]) => ({ type: 'isNotNull', args })),
  sql: Object.assign(jest.fn((...args: unknown[]) => ({ type: 'sql', args })), {
    raw: jest.fn(),
  }),
}))

jest.mock('@/lib/api/oposicion-scope/queries', () => ({
  getAllowedLawIds: jest.fn().mockResolvedValue({
    positionType: 'auxiliar_administrativo_estado',
    lawIds: ['law-1', 'law-2'],
    lawShortNames: ['LECrim', 'LO 6/1985'],
  }),
}))

import { getUserProblematicArticlesWeeklyCached } from '@/lib/api/notifications/queries'

const VALID_REQ = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
} as Parameters<typeof getUserProblematicArticlesWeeklyCached>[0]

describe('getUserProblematicArticlesWeeklyCached — feature flag', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    mockCachedFn.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('flag undefined → usa unstable_cache', async () => {
    delete process.env.CACHE_PROBLEMATIC_ARTICLES
    await getUserProblematicArticlesWeeklyCached(VALID_REQ)
    expect(mockCachedFn).toHaveBeenCalledTimes(1)
  })

  test('flag "true" → usa unstable_cache', async () => {
    process.env.CACHE_PROBLEMATIC_ARTICLES = 'true'
    await getUserProblematicArticlesWeeklyCached(VALID_REQ)
    expect(mockCachedFn).toHaveBeenCalledTimes(1)
  })

  test('flag "false" → bypass al fetcher real, NO unstable_cache', async () => {
    process.env.CACHE_PROBLEMATIC_ARTICLES = 'false'
    await getUserProblematicArticlesWeeklyCached(VALID_REQ)
    expect(mockCachedFn).not.toHaveBeenCalled()
  })

  test('userIds distintos → cache keys distintos (no cross-user leakage)', async () => {
    delete process.env.CACHE_PROBLEMATIC_ARTICLES

    const userA = { userId: '550e8400-e29b-41d4-a716-446655440001' } as Parameters<typeof getUserProblematicArticlesWeeklyCached>[0]
    const userB = { userId: '550e8400-e29b-41d4-a716-446655440002' } as Parameters<typeof getUserProblematicArticlesWeeklyCached>[0]

    await getUserProblematicArticlesWeeklyCached(userA)
    await getUserProblematicArticlesWeeklyCached(userB)

    // unstable_cache key-by-args separa users distintos
    expect(mockCachedFn).toHaveBeenCalledTimes(2)
    expect(mockCachedFn).toHaveBeenNthCalledWith(1, userA)
    expect(mockCachedFn).toHaveBeenNthCalledWith(2, userB)
  })

  test('mismas args → mismo cache key (varios calls del mismo user)', async () => {
    delete process.env.CACHE_PROBLEMATIC_ARTICLES
    await getUserProblematicArticlesWeeklyCached(VALID_REQ)
    await getUserProblematicArticlesWeeklyCached(VALID_REQ)
    await getUserProblematicArticlesWeeklyCached(VALID_REQ)

    // 3 calls al wrapper, todos con misma key
    expect(mockCachedFn).toHaveBeenCalledTimes(3)
    expect(mockCachedFn).toHaveBeenNthCalledWith(1, VALID_REQ)
    expect(mockCachedFn).toHaveBeenNthCalledWith(2, VALID_REQ)
    expect(mockCachedFn).toHaveBeenNthCalledWith(3, VALID_REQ)
  })
})
