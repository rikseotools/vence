/**
 * Tests para verify-articles/errors: queries con filtros
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

// ============================================
// QUERY TESTS
// ============================================

describe('Verify Articles - Errors Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getVerificationErrors should return errors array', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([
                  { id: 'err-1', lawId: 'law-uuid-1', articleNumber: '10', errorMessage: 'Parse error', errorType: 'json_parse' },
                  { id: 'err-2', lawId: 'law-uuid-1', articleNumber: '15', errorMessage: 'Timeout', errorType: 'timeout' },
                ]),
              }),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      aiVerificationErrors: {
        lawId: 'law_id',
        articleNumber: 'article_number',
        createdAt: 'created_at',
      },
    }))

    const { getVerificationErrors } = require('@/lib/api/verify-articles/queries')
    const result = await getVerificationErrors('law-uuid-1', 50)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
    expect(result[0].errorMessage).toBe('Parse error')
  })

  it('getVerificationErrors should filter by lawId', async () => {
    const targetLawId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    let capturedLawId: string | null = null

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: (...args: unknown[]) => {
              capturedLawId = targetLawId
              return {
                orderBy: () => ({
                  limit: () => Promise.resolve([
                    { id: 'err-1', lawId: targetLawId, articleNumber: '5' },
                  ]),
                }),
              }
            },
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      aiVerificationErrors: {
        lawId: 'law_id',
        articleNumber: 'article_number',
        createdAt: 'created_at',
      },
    }))

    const { getVerificationErrors } = require('@/lib/api/verify-articles/queries')
    const result = await getVerificationErrors(targetLawId, 20)
    expect(result).toHaveLength(1)
    expect(result[0].lawId).toBe(targetLawId)
    expect(capturedLawId).toBe(targetLawId)
  })

  it('getVerificationErrors should support articles filter (comma-separated in route)', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([
                  { id: 'err-1', articleNumber: '10', errorMessage: 'Error A' },
                  { id: 'err-2', articleNumber: '12', errorMessage: 'Error B' },
                ]),
              }),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      aiVerificationErrors: {
        lawId: 'law_id',
        articleNumber: 'article_number',
        createdAt: 'created_at',
      },
    }))

    const { getVerificationErrors } = require('@/lib/api/verify-articles/queries')
    // The route splits comma-separated articles before calling the query
    const articleList = '10,12'.split(',')
    const result = await getVerificationErrors('law-uuid-1', 50, articleList)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
    expect(result[0].articleNumber).toBe('10')
    expect(result[1].articleNumber).toBe('12')
  })
})
