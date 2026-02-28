/**
 * Tests para verify-articles/add-missing: schemas, queries y route logic
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { addMissingParamsSchema } from '@/lib/api/verify-articles/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Verify Articles - Add Missing - Schemas', () => {
  describe('addMissingParamsSchema', () => {
    const validUuid = '00000000-0000-0000-0000-000000000001'

    it('should accept valid params', () => {
      const result = addMissingParamsSchema.safeParse({
        lawId: validUuid,
        articleNumbers: ['1', '2', '3'],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.lawId).toBe(validUuid)
        expect(result.data.articleNumbers).toEqual(['1', '2', '3'])
      }
    })

    it('should accept with includeDisposiciones true', () => {
      const result = addMissingParamsSchema.safeParse({
        lawId: validUuid,
        articleNumbers: ['DA_1'],
        includeDisposiciones: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeDisposiciones).toBe(true)
      }
    })

    it('should default includeDisposiciones to false', () => {
      const result = addMissingParamsSchema.safeParse({
        lawId: validUuid,
        articleNumbers: ['1'],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeDisposiciones).toBe(false)
      }
    })

    it('should reject missing lawId', () => {
      const result = addMissingParamsSchema.safeParse({
        articleNumbers: ['1', '2'],
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty articleNumbers array', () => {
      const result = addMissingParamsSchema.safeParse({
        lawId: validUuid,
        articleNumbers: [],
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID lawId', () => {
      const result = addMissingParamsSchema.safeParse({
        lawId: 'not-a-uuid',
        articleNumbers: ['1'],
      })
      expect(result.success).toBe(false)
    })

    it('should reject articleNumbers with empty strings', () => {
      const result = addMissingParamsSchema.safeParse({
        lawId: validUuid,
        articleNumbers: [''],
      })
      expect(result.success).toBe(false)
    })

    it('should accept single articleNumber', () => {
      const result = addMissingParamsSchema.safeParse({
        lawId: validUuid,
        articleNumbers: ['15 bis'],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.articleNumbers).toEqual(['15 bis'])
      }
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Verify Articles - Add Missing - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should call getLawById and return law data', async () => {
    const mockLaw = [{
      id: '00000000-0000-0000-0000-000000000001',
      shortName: 'CE',
      name: 'Constitucion Espanola',
      boeUrl: 'https://www.boe.es/buscar/act.php?id=BOE-A-1978-31229',
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
    expect(result.shortName).toBe('CE')
    expect(result.boeUrl).toContain('boe.es')
  })

  it('should return null when law not found', async () => {
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

  it('should call getExistingArticleNumbers and return article numbers', async () => {
    const mockArticles = [
      { articleNumber: '1' },
      { articleNumber: '2' },
      { articleNumber: '3' },
    ]

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve(mockArticles),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      articles: { articleNumber: 'article_number', lawId: 'law_id', isActive: 'is_active' },
    }))

    const { getExistingArticleNumbers } = require('@/lib/api/verify-articles/queries')
    const result = await getExistingArticleNumbers('00000000-0000-0000-0000-000000000001')

    expect(result).toEqual(['1', '2', '3'])
  })

  it('should call insertArticles and return inserted articles', async () => {
    const insertedRows = [
      { id: 'new-art-1', articleNumber: '10', title: 'Art 10' },
      { id: 'new-art-2', articleNumber: '11', title: 'Art 11' },
    ]

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        insert: () => ({
          values: () => ({
            returning: () => Promise.resolve(insertedRows),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      articles: { id: 'id', articleNumber: 'article_number', title: 'title' },
    }))

    const { insertArticles } = require('@/lib/api/verify-articles/queries')
    const result = await insertArticles([
      {
        lawId: '00000000-0000-0000-0000-000000000001',
        articleNumber: '10',
        title: 'Art 10',
        content: 'Content',
        contentHash: 'hash',
        isActive: true,
        isVerified: true,
        verificationDate: '2025-01-01',
        lastModificationDate: '2025-01-01',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ])

    expect(result).toHaveLength(2)
    expect(result[0].articleNumber).toBe('10')
  })
})
