// __tests__/lib/api/test-config/cachedWrappers.test.ts
// Tests de los wrappers cacheados de test-config (Fase 4).
//
// Garantiza el contrato de feature flags por endpoint:
//   - CACHE_TEST_CONFIG_SECTIONS=false   → bypass a fetcher real
//   - CACHE_TEST_CONFIG_ARTICLES=false   → bypass
//   - CACHE_TEST_CONFIG_ESSENTIAL=false  → bypass
//   - sin flag o 'true'                   → unstable_cache se usa
//
// El test mockea unstable_cache para distinguir si el wrapper invocó la
// versión cacheada o la cruda.

// ============================================
// MOCKS
// ============================================

// Mock de unstable_cache: cuando el wrapper lo llame, ejecuta el fetcher
// pero etiqueta el call para que el test pueda discriminar cache vs no-cache.
const mockCachedFn = jest.fn()
jest.mock('next/cache', () => ({
  unstable_cache: jest.fn((fn: Function) => {
    // Devolver una función que delega al original pero también pase por
    // mockCachedFn para que los tests puedan inspeccionar.
    return (...args: unknown[]) => {
      mockCachedFn(...args)
      return fn(...args)
    }
  }),
}))

// Mock del módulo db/client (las queries de test-config llaman a getDb)
const mockSelect = jest.fn().mockReturnValue({
  from: jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue([]),
    leftJoin: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([]),
      leftJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
    }),
    innerJoin: jest.fn().mockReturnValue({
      innerJoin: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      }),
      where: jest.fn().mockResolvedValue([]),
    }),
  }),
})
jest.mock('@/db/client', () => ({
  getDb: jest.fn(() => ({ select: mockSelect })),
}))

jest.mock('@/db/schema', () => ({
  questions: { id: 'id', isActive: 'is_active', primaryArticleId: 'primary_article_id' },
  articles: { id: 'id', lawId: 'law_id', articleNumber: 'article_number', title: 'title', sectionId: 'section_id' },
  laws: { id: 'id', shortName: 'short_name', name: 'name', slug: 'slug' },
  topicScope: { id: 'id', topicId: 'topic_id', lawId: 'law_id', articleNumbers: 'article_numbers' },
  topics: { id: 'id', topicNumber: 'topic_number', positionType: 'position_type' },
  lawSections: { id: 'id', lawId: 'law_id', name: 'name', orderIndex: 'order_index' },
}))

jest.mock('drizzle-orm', () => ({
  eq: jest.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: jest.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: jest.fn((...args: unknown[]) => ({ type: 'inArray', args })),
  sql: Object.assign(jest.fn((...args: unknown[]) => ({ type: 'sql', args })), {
    raw: jest.fn(),
  }),
}))

jest.mock('@/lib/config/exam-positions', () => ({
  getValidExamPositions: jest.fn(() => ['auxiliar_administrativo_estado']),
}))

// ============================================
// IMPORTS (después de mocks)
// ============================================

import {
  getScopedLawSectionsCached,
  getArticlesForLawCached,
  getEssentialArticlesCached,
} from '@/lib/api/test-config/queries'

// ============================================
// TESTS — feature flag bypass
// ============================================

describe('test-config cached wrappers — feature flags', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    mockCachedFn.mockReset()
    mockSelect.mockClear()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getScopedLawSectionsCached', () => {
    test('flag undefined → usa unstable_cache', async () => {
      delete process.env.CACHE_TEST_CONFIG_SECTIONS
      await getScopedLawSectionsCached({
        lawShortName: 'CE',
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
      } as Parameters<typeof getScopedLawSectionsCached>[0])

      expect(mockCachedFn).toHaveBeenCalledTimes(1)
    })

    test('flag "true" → usa unstable_cache', async () => {
      process.env.CACHE_TEST_CONFIG_SECTIONS = 'true'
      await getScopedLawSectionsCached({
        lawShortName: 'CE',
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
      } as Parameters<typeof getScopedLawSectionsCached>[0])

      expect(mockCachedFn).toHaveBeenCalledTimes(1)
    })

    test('flag "false" → bypass al fetcher real, NO unstable_cache', async () => {
      process.env.CACHE_TEST_CONFIG_SECTIONS = 'false'
      await getScopedLawSectionsCached({
        lawShortName: 'CE',
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
      } as Parameters<typeof getScopedLawSectionsCached>[0])

      expect(mockCachedFn).not.toHaveBeenCalled()
    })
  })

  describe('getArticlesForLawCached', () => {
    test('flag "false" → bypass', async () => {
      process.env.CACHE_TEST_CONFIG_ARTICLES = 'false'
      await getArticlesForLawCached({
        lawShortName: 'CE',
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
        includeOfficialCount: false,
      } as Parameters<typeof getArticlesForLawCached>[0])

      expect(mockCachedFn).not.toHaveBeenCalled()
    })

    test('flag undefined → usa cache', async () => {
      delete process.env.CACHE_TEST_CONFIG_ARTICLES
      await getArticlesForLawCached({
        lawShortName: 'CE',
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
        includeOfficialCount: false,
      } as Parameters<typeof getArticlesForLawCached>[0])

      expect(mockCachedFn).toHaveBeenCalledTimes(1)
    })
  })

  describe('getEssentialArticlesCached', () => {
    test('flag "false" → bypass', async () => {
      process.env.CACHE_TEST_CONFIG_ESSENTIAL = 'false'
      await getEssentialArticlesCached({
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
      } as Parameters<typeof getEssentialArticlesCached>[0])

      expect(mockCachedFn).not.toHaveBeenCalled()
    })

    test('flag undefined → usa cache', async () => {
      delete process.env.CACHE_TEST_CONFIG_ESSENTIAL
      await getEssentialArticlesCached({
        topicNumber: 1,
        positionType: 'auxiliar_administrativo_estado',
      } as Parameters<typeof getEssentialArticlesCached>[0])

      expect(mockCachedFn).toHaveBeenCalledTimes(1)
    })
  })

  test('flags son independientes — desactivar SECTIONS no afecta ARTICLES', async () => {
    process.env.CACHE_TEST_CONFIG_SECTIONS = 'false'
    delete process.env.CACHE_TEST_CONFIG_ARTICLES
    delete process.env.CACHE_TEST_CONFIG_ESSENTIAL

    await getScopedLawSectionsCached({
      lawShortName: 'CE',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    } as Parameters<typeof getScopedLawSectionsCached>[0])
    await getArticlesForLawCached({
      lawShortName: 'CE',
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
      includeOfficialCount: false,
    } as Parameters<typeof getArticlesForLawCached>[0])
    await getEssentialArticlesCached({
      topicNumber: 1,
      positionType: 'auxiliar_administrativo_estado',
    } as Parameters<typeof getEssentialArticlesCached>[0])

    // Sections debería bypassear (flag=false), articles y essential usar cache.
    expect(mockCachedFn).toHaveBeenCalledTimes(2)
  })
})
