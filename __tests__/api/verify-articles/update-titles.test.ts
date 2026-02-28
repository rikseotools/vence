/**
 * Tests para verify-articles/update-titles: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { updateTitlesParamsSchema, updateTitlesArticleSchema } from '@/lib/api/verify-articles/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Verify Articles - Update Titles Schema', () => {
  describe('updateTitlesArticleSchema', () => {
    it('should accept full article data', () => {
      const result = updateTitlesArticleSchema.safeParse({
        article_number: '15',
        boe_title: 'Del derecho a la educación',
        db_title: 'Derecho a la educación',
        db_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      })
      expect(result.success).toBe(true)
    })

    it('should accept minimal: just article_number', () => {
      const result = updateTitlesArticleSchema.safeParse({
        article_number: '3',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty article_number', () => {
      const result = updateTitlesArticleSchema.safeParse({
        article_number: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID db_id', () => {
      const result = updateTitlesArticleSchema.safeParse({
        article_number: '10',
        db_id: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('updateTitlesParamsSchema', () => {
    it('should accept valid with full article data', () => {
      const result = updateTitlesParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        articles: [
          {
            article_number: '15',
            boe_title: 'Del derecho a la educación',
            db_title: 'Derecho a la educación',
            db_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('should accept minimal: just lawId + articles with article_number', () => {
      const result = updateTitlesParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        articles: [{ article_number: '1' }],
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing lawId', () => {
      const result = updateTitlesParamsSchema.safeParse({
        articles: [{ article_number: '1' }],
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty articles array', () => {
      const result = updateTitlesParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        articles: [],
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID lawId', () => {
      const result = updateTitlesParamsSchema.safeParse({
        lawId: 'not-a-uuid',
        articles: [{ article_number: '1' }],
      })
      expect(result.success).toBe(false)
    })

    it('should reject article with empty article_number', () => {
      const result = updateTitlesParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        articles: [{ article_number: '' }],
      })
      expect(result.success).toBe(false)
    })

    it('should accept multiple articles', () => {
      const result = updateTitlesParamsSchema.safeParse({
        lawId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        articles: [
          { article_number: '1', boe_title: 'Titulo 1' },
          { article_number: '2', db_title: 'Titulo 2' },
          { article_number: '3' },
        ],
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Verify Articles - Update Titles Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getLawById should return law or null', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([
                { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', shortName: 'CE', name: 'Constitución Española', boeUrl: 'https://boe.es/ce' },
              ]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      laws: { id: 'id', shortName: 'short_name', name: 'name', boeUrl: 'boe_url' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { getLawById } = require('@/lib/api/verify-articles/queries')
    const result = await getLawById('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(result).toBeDefined()
    expect(result.shortName).toBe('CE')
  })

  it('updateArticle should call update without error', async () => {
    const mockSet = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    })

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        update: () => ({ set: mockSet }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      articles: { id: 'id', title: 'title', content: 'content', lawId: 'law_id', articleNumber: 'article_number', isActive: 'is_active' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { updateArticle } = require('@/lib/api/verify-articles/queries')
    await expect(updateArticle('some-id', { title: 'New title' })).resolves.not.toThrow()
  })

  it('insertArticleUpdateLog should call insert without error', async () => {
    const mockValues = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        insert: () => ({ values: mockValues }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      articleUpdateLogs: { lawId: 'law_id', articleId: 'article_id' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { insertArticleUpdateLog } = require('@/lib/api/verify-articles/queries')
    await expect(
      insertArticleUpdateLog({
        lawId: 'law-id',
        articleId: 'article-id',
        articleNumber: '15',
        oldTitle: 'Old',
        newTitle: 'New',
        changeType: 'title_update',
        source: 'boe',
      })
    ).resolves.not.toThrow()
  })

  it('getArticleUpdateLogs should return array', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([
                  { lawId: 'law-id', articleNumber: '15', changeType: 'title_update' },
                ]),
              }),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      articleUpdateLogs: { lawId: 'law_id', createdAt: 'created_at' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { getArticleUpdateLogs } = require('@/lib/api/verify-articles/queries')
    const result = await getArticleUpdateLogs('law-id')
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(1)
  })
})
