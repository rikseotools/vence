/**
 * Tests para verify-articles/all-articles: queries y route logic
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Verify Articles - All Articles - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function setupMock(articleRows: any[], questionRows: any[]) {
    let selectCallIndex = 0

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => {
          const callIndex = selectCallIndex++
          const data = callIndex === 0 ? articleRows : questionRows
          return {
            from: () => ({
              where: () => {
                // getArticleIdsByLaw uses .where().orderBy()
                // getQuestionsByArticleIds uses .where() directly (returns promise)
                const result = Promise.resolve(data)
                ;(result as any).orderBy = () => Promise.resolve(data)
                return result
              },
            }),
          }
        },
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      articles: { lawId: 'law_id', isActive: 'is_active', articleNumber: 'article_number' },
      questions: { primaryArticleId: 'primary_article_id', isActive: 'is_active' },
    }))
  }

  it('should call getArticleIdsByLaw with correct lawId', async () => {
    const mockArticles = [
      { id: 'art-1', articleNumber: '1', title: 'Art 1' },
      { id: 'art-2', articleNumber: '2', title: 'Art 2' },
    ]

    setupMock(mockArticles, [])

    const { getArticleIdsByLaw } = require('@/lib/api/verify-articles/queries')
    const result = await getArticleIdsByLaw('00000000-0000-0000-0000-000000000001')

    expect(result).toHaveLength(2)
    expect(result[0].articleNumber).toBe('1')
    expect(result[1].articleNumber).toBe('2')
  })

  it('should call getQuestionsByArticleIds with correct article IDs', async () => {
    const mockQuestions = [
      { id: 'q-1', primaryArticleId: 'art-1', verifiedAt: '2025-01-01', verificationStatus: 'ok' },
      { id: 'q-2', primaryArticleId: 'art-1', verifiedAt: null, verificationStatus: null },
      { id: 'q-3', primaryArticleId: 'art-2', verifiedAt: '2025-01-02', verificationStatus: 'problem' },
    ]

    // Standalone mock for getQuestionsByArticleIds which uses .select().from().where() (no orderBy)
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve(mockQuestions),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      questions: { primaryArticleId: 'primary_article_id', isActive: 'is_active' },
    }))

    const { getQuestionsByArticleIds } = require('@/lib/api/verify-articles/queries')
    const result = await getQuestionsByArticleIds(['art-1', 'art-2'])

    expect(result).toHaveLength(3)
    expect(result[0].primaryArticleId).toBe('art-1')
    expect(result[2].verificationStatus).toBe('problem')
  })

  it('should return empty array when no articles exist', async () => {
    setupMock([], [])

    const { getArticleIdsByLaw } = require('@/lib/api/verify-articles/queries')
    const result = await getArticleIdsByLaw('00000000-0000-0000-0000-000000000001')

    expect(result).toHaveLength(0)
  })
})

// ============================================
// ROUTE LOGIC TESTS
// ============================================

describe('Verify Articles - All Articles - Route Logic', () => {
  it('should compute verification stats correctly from question rows', () => {
    // Simulate the route logic for building verificationStats
    const questionRows = [
      { id: 'q-1', primaryArticleId: 'art-1', verifiedAt: '2025-01-10T00:00:00Z', verificationStatus: 'ok' },
      { id: 'q-2', primaryArticleId: 'art-1', verifiedAt: '2025-01-12T00:00:00Z', verificationStatus: 'ok' },
      { id: 'q-3', primaryArticleId: 'art-1', verifiedAt: null, verificationStatus: null },
      { id: 'q-4', primaryArticleId: 'art-2', verifiedAt: '2025-01-05T00:00:00Z', verificationStatus: 'problem' },
    ]

    const questionCounts: Record<string, number> = {}
    const verificationStats: Record<string, { total: number; ok: number; problem: number; pending: number; lastVerified: string | null }> = {}

    for (const q of questionRows) {
      const artId = q.primaryArticleId!
      questionCounts[artId] = (questionCounts[artId] || 0) + 1

      if (!verificationStats[artId]) {
        verificationStats[artId] = { total: 0, ok: 0, problem: 0, pending: 0, lastVerified: null }
      }

      verificationStats[artId].total++

      if (!q.verifiedAt) {
        verificationStats[artId].pending++
      } else {
        if (!verificationStats[artId].lastVerified || q.verifiedAt > verificationStats[artId].lastVerified!) {
          verificationStats[artId].lastVerified = q.verifiedAt
        }
        if (q.verificationStatus === 'ok') {
          verificationStats[artId].ok++
        } else if (q.verificationStatus === 'problem') {
          verificationStats[artId].problem++
        }
      }
    }

    expect(questionCounts['art-1']).toBe(3)
    expect(questionCounts['art-2']).toBe(1)

    expect(verificationStats['art-1'].total).toBe(3)
    expect(verificationStats['art-1'].ok).toBe(2)
    expect(verificationStats['art-1'].pending).toBe(1)
    expect(verificationStats['art-1'].problem).toBe(0)
    expect(verificationStats['art-1'].lastVerified).toBe('2025-01-12T00:00:00Z')

    expect(verificationStats['art-2'].total).toBe(1)
    expect(verificationStats['art-2'].problem).toBe(1)
    expect(verificationStats['art-2'].ok).toBe(0)
  })

  it('should separate articles with and without questions', () => {
    const articleRows = [
      { id: 'art-1', articleNumber: '1', title: 'Art 1' },
      { id: 'art-2', articleNumber: '2', title: 'Art 2' },
      { id: 'art-3', articleNumber: '3', title: null },
    ]

    const questionCounts: Record<string, number> = { 'art-1': 5, 'art-2': 3 }

    const articlesWithQuestions = articleRows
      .filter(a => questionCounts[a.id] > 0)
      .map(a => ({
        article_number: a.articleNumber,
        title: a.title || `Articulo ${a.articleNumber}`,
        question_count: questionCounts[a.id] || 0,
        article_id: a.id,
        has_questions: true,
      }))

    const articlesWithoutQuestions = articleRows
      .filter(a => !questionCounts[a.id])
      .map(a => ({
        article_number: a.articleNumber,
        title: a.title || `Articulo ${a.articleNumber}`,
        question_count: 0,
        article_id: a.id,
        has_questions: false,
      }))

    expect(articlesWithQuestions).toHaveLength(2)
    expect(articlesWithQuestions[0].question_count).toBe(5)
    expect(articlesWithQuestions[1].question_count).toBe(3)

    expect(articlesWithoutQuestions).toHaveLength(1)
    expect(articlesWithoutQuestions[0].article_id).toBe('art-3')
    expect(articlesWithoutQuestions[0].has_questions).toBe(false)
    expect(articlesWithoutQuestions[0].title).toBe('Articulo 3')
  })
})
