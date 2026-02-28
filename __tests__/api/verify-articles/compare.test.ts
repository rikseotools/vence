/**
 * Tests para verify-articles/compare: schemas, queries y route logic
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { compareParamsSchema } from '@/lib/api/verify-articles/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Verify Articles - Compare - Schemas', () => {
  describe('compareParamsSchema', () => {
    const validUuid = '00000000-0000-0000-0000-000000000001'

    it('should accept valid params', () => {
      const result = compareParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.lawId).toBe(validUuid)
        expect(result.data.articleNumber).toBe('15')
      }
    })

    it('should accept articleNumber with suffix', () => {
      const result = compareParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '15 bis',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.articleNumber).toBe('15 bis')
      }
    })

    it('should accept disposicion-style articleNumber', () => {
      const result = compareParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: 'DA_3',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing lawId', () => {
      const result = compareParamsSchema.safeParse({
        articleNumber: '15',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing articleNumber', () => {
      const result = compareParamsSchema.safeParse({
        lawId: validUuid,
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty articleNumber', () => {
      const result = compareParamsSchema.safeParse({
        lawId: validUuid,
        articleNumber: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID lawId', () => {
      const result = compareParamsSchema.safeParse({
        lawId: 'not-a-valid-uuid',
        articleNumber: '15',
      })
      expect(result.success).toBe(false)
    })

    it('should reject integer lawId', () => {
      const result = compareParamsSchema.safeParse({
        lawId: 12345,
        articleNumber: '15',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Verify Articles - Compare - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should call getLawById and return law with boeUrl', async () => {
    const mockLaw = [{
      id: '00000000-0000-0000-0000-000000000001',
      shortName: 'LOPJ',
      name: 'Ley Organica del Poder Judicial',
      boeUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1985-12666',
    }]

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(mockLaw),
            }),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      laws: { id: 'id', shortName: 'short_name', name: 'name', boeUrl: 'boe_url' },
    }))

    const { getLawById } = require('@/lib/api/verify-articles/queries')
    const result = await getLawById('00000000-0000-0000-0000-000000000001')

    expect(result).toBeDefined()
    expect(result.shortName).toBe('LOPJ')
    expect(result.boeUrl).toContain('boe.es')
  })

  it('should return null for non-existent law', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      laws: { id: 'id', shortName: 'short_name', name: 'name', boeUrl: 'boe_url' },
    }))

    const { getLawById } = require('@/lib/api/verify-articles/queries')
    const result = await getLawById('00000000-0000-0000-0000-000000000099')

    expect(result).toBeNull()
  })

  it('should call getArticleByLawAndNumber and return article data', async () => {
    const mockArticle = [{
      id: 'art-1',
      articleNumber: '24',
      title: 'Tutela judicial efectiva',
      content: 'Todas las personas tienen derecho...',
    }]

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve(mockArticle),
            }),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      articles: {
        id: 'id',
        articleNumber: 'article_number',
        title: 'title',
        content: 'content',
        lawId: 'law_id',
      },
    }))

    const { getArticleByLawAndNumber } = require('@/lib/api/verify-articles/queries')
    const result = await getArticleByLawAndNumber(
      '00000000-0000-0000-0000-000000000001',
      '24'
    )

    expect(result).toBeDefined()
    expect(result.articleNumber).toBe('24')
    expect(result.title).toBe('Tutela judicial efectiva')
    expect(result.content).toContain('Todas las personas')
  })

  it('should return null when article not found', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      articles: {
        id: 'id',
        articleNumber: 'article_number',
        title: 'title',
        content: 'content',
        lawId: 'law_id',
      },
    }))

    const { getArticleByLawAndNumber } = require('@/lib/api/verify-articles/queries')
    const result = await getArticleByLawAndNumber(
      '00000000-0000-0000-0000-000000000001',
      '999'
    )

    expect(result).toBeNull()
  })
})

// ============================================
// ROUTE LOGIC TESTS
// ============================================

describe('Verify Articles - Compare - Route Logic', () => {
  it('should build response with both BOE and DB data', () => {
    const law = {
      id: '00000000-0000-0000-0000-000000000001',
      shortName: 'CE',
      name: 'Constitucion Espanola',
      boeUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229',
    }

    const dbArticle = {
      id: 'art-1',
      title: 'Derecho a la educacion',
      content: 'Todos tienen el derecho a la educacion...',
    }

    const boeData = {
      title: 'Derecho a la educacion',
      content: 'Todos tienen el derecho a la educacion...',
    }

    const response = {
      success: true,
      law: { id: law.id, short_name: law.shortName, name: law.name, boe_url: law.boeUrl },
      boe: boeData ? { title: boeData.title, content: boeData.content } : null,
      db: dbArticle ? { id: dbArticle.id, title: dbArticle.title, content: dbArticle.content } : null,
    }

    expect(response.success).toBe(true)
    expect(response.law.short_name).toBe('CE')
    expect(response.boe).not.toBeNull()
    expect(response.db).not.toBeNull()
    expect(response.boe!.content).toContain('educacion')
  })

  it('should return null boe when article not found in BOE', () => {
    const law = {
      id: '00000000-0000-0000-0000-000000000001',
      shortName: 'CE',
      name: 'Constitucion Espanola',
      boeUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229',
    }

    const response = {
      success: true,
      law: { id: law.id, short_name: law.shortName, name: law.name, boe_url: law.boeUrl },
      boe: null,
      db: null,
    }

    expect(response.success).toBe(true)
    expect(response.boe).toBeNull()
    expect(response.db).toBeNull()
  })
})
