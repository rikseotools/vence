// __tests__/lib/api/law-stats/cachedWrapper.test.ts
// Tests del feature flag de queryLawStatsCached (Phase 4c).

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
        where: jest.fn().mockResolvedValue([{ total: 0, official: 0 }]),
      }),
    }),
  }),
})
jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({ select: mockSelect })),
}))

jest.mock('@/db/schema', () => ({
  questions: { id: 'id', isActive: 'is_active', isOfficialExam: 'is_official_exam', primaryArticleId: 'primary_article_id', examCaseId: 'exam_case_id' },
  articles: { id: 'id', lawId: 'law_id' },
  laws: { id: 'id', shortName: 'short_name' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  isNull: jest.fn((...args: unknown[]) => ({ type: 'isNull', args })),
  sql: Object.assign(jest.fn((...args: unknown[]) => ({ type: 'sql', args, as: () => ({}) })), {
    raw: jest.fn(),
  }),
}))

import { queryLawStatsCached } from '@/lib/api/law-stats/queries'

describe('queryLawStatsCached — feature flag', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    mockCachedFn.mockReset()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('flag undefined → usa unstable_cache', async () => {
    delete process.env.CACHE_LAW_STATS
    await queryLawStatsCached('CE')
    expect(mockCachedFn).toHaveBeenCalledTimes(1)
    expect(mockCachedFn).toHaveBeenCalledWith('CE')
  })

  test('flag "true" → usa unstable_cache', async () => {
    process.env.CACHE_LAW_STATS = 'true'
    await queryLawStatsCached('CE')
    expect(mockCachedFn).toHaveBeenCalledTimes(1)
  })

  test('flag "false" → bypass al fetcher real, NO unstable_cache', async () => {
    process.env.CACHE_LAW_STATS = 'false'
    await queryLawStatsCached('CE')
    expect(mockCachedFn).not.toHaveBeenCalled()
  })

  test('lawShortNames distintos → cache keys distintos', async () => {
    delete process.env.CACHE_LAW_STATS
    await queryLawStatsCached('CE')
    await queryLawStatsCached('Ley 39/2015')
    expect(mockCachedFn).toHaveBeenCalledTimes(2)
    expect(mockCachedFn).toHaveBeenNthCalledWith(1, 'CE')
    expect(mockCachedFn).toHaveBeenNthCalledWith(2, 'Ley 39/2015')
  })
})
