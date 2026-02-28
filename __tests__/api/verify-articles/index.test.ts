/**
 * Tests para verify-articles (main route): schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { verifyArticlesParamsSchema } from '@/lib/api/verify-articles/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Verify Articles - Main Route Schema', () => {
  describe('verifyArticlesParamsSchema', () => {
    const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

    it('should accept with lawId only', () => {
      const result = verifyArticlesParamsSchema.safeParse({
        lawId: validUuid,
      })
      expect(result.success).toBe(true)
    })

    it('should accept with law only', () => {
      const result = verifyArticlesParamsSchema.safeParse({
        law: 'CE',
      })
      expect(result.success).toBe(true)
    })

    it('should accept with both lawId and law', () => {
      const result = verifyArticlesParamsSchema.safeParse({
        lawId: validUuid,
        law: 'CE',
      })
      expect(result.success).toBe(true)
    })

    it('should accept with includeDisposiciones true', () => {
      const result = verifyArticlesParamsSchema.safeParse({
        lawId: validUuid,
        includeDisposiciones: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeDisposiciones).toBe(true)
      }
    })

    it('should default includeDisposiciones to false', () => {
      const result = verifyArticlesParamsSchema.safeParse({
        lawId: validUuid,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.includeDisposiciones).toBe(false)
      }
    })

    it('should reject when both lawId and law are missing (refine fails)', () => {
      const result = verifyArticlesParamsSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject when only includeDisposiciones is provided', () => {
      const result = verifyArticlesParamsSchema.safeParse({
        includeDisposiciones: true,
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID lawId', () => {
      const result = verifyArticlesParamsSchema.safeParse({
        lawId: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty law string', () => {
      const result = verifyArticlesParamsSchema.safeParse({
        law: '',
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Verify Articles - Main Route Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getLawById should return law data', async () => {
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
    expect(result.boeUrl).toBe('https://boe.es/ce')
  })

  it('getLawById should return null for non-existent law', async () => {
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
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { getLawById } = require('@/lib/api/verify-articles/queries')
    const result = await getLawById('nonexistent-uuid-0000-0000-000000000000')
    expect(result).toBeNull()
  })

  it('getLawByShortName should return law data', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([
                { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', shortName: 'LPAC', name: 'Ley 39/2015', boeUrl: 'https://boe.es/lpac' },
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

    const { getLawByShortName } = require('@/lib/api/verify-articles/queries')
    const result = await getLawByShortName('LPAC')
    expect(result).toBeDefined()
    expect(result.shortName).toBe('LPAC')
  })

  it('getActiveArticlesByLaw should return articles array', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([
                { id: 'art-1', articleNumber: '1', title: 'Art 1', content: 'Content 1' },
                { id: 'art-2', articleNumber: '2', title: 'Art 2', content: 'Content 2' },
              ]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      articles: { id: 'id', articleNumber: 'article_number', title: 'title', content: 'content', lawId: 'law_id', isActive: 'is_active' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { getActiveArticlesByLaw } = require('@/lib/api/verify-articles/queries')
    const result = await getActiveArticlesByLaw('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
    expect(result[0].articleNumber).toBe('1')
  })

  it('updateLawVerification should call update without error', async () => {
    const mockSet = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    })

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        update: () => ({ set: mockSet }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      laws: { id: 'id', lastChecked: 'last_checked', lastVerificationSummary: 'last_verification_summary' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { updateLawVerification } = require('@/lib/api/verify-articles/queries')
    await expect(
      updateLawVerification('a1b2c3d4-e5f6-7890-abcd-ef1234567890', { total: 10, ok: 10 })
    ).resolves.not.toThrow()
  })
})
