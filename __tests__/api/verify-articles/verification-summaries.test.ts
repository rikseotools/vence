/**
 * Tests para verify-articles/verification-summaries: queries y route logic
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Verify Articles - Verification Summaries - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function setupMock(articleRows: any[], questionRows: any[], verificationRows: any[]) {
    let selectCallIndex = 0

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => {
          const callIndex = selectCallIndex++
          if (callIndex === 0) {
            // getArticlesByLawAndNumbers: .select().from().where() (no orderBy)
            return {
              from: () => ({
                where: () => Promise.resolve(articleRows),
              }),
            }
          } else if (callIndex === 1) {
            // getQuestionsByArticleIds: .select().from().where() (no orderBy)
            return {
              from: () => ({
                where: () => Promise.resolve(questionRows),
              }),
            }
          } else {
            // getVerificationResultsByQuestionIds: .select().from().where().orderBy()
            return {
              from: () => ({
                where: () => ({
                  orderBy: () => Promise.resolve(verificationRows),
                }),
              }),
            }
          }
        },
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      articles: { lawId: 'law_id', articleNumber: 'article_number' },
      questions: { primaryArticleId: 'primary_article_id', isActive: 'is_active' },
      aiVerificationResults: { questionId: 'question_id', verifiedAt: 'verified_at' },
    }))
  }

  it('should call getArticlesByLawAndNumbers and return matched articles', async () => {
    const mockArticles = [
      { id: 'art-1', articleNumber: '10' },
      { id: 'art-2', articleNumber: '11' },
    ]

    setupMock(mockArticles, [], [])

    const { getArticlesByLawAndNumbers } = require('@/lib/api/verify-articles/queries')
    const result = await getArticlesByLawAndNumbers(
      '00000000-0000-0000-0000-000000000001',
      ['10', '11']
    )

    expect(result).toHaveLength(2)
    expect(result[0].articleNumber).toBe('10')
  })

  it('should call getVerificationResultsByQuestionIds and return results', async () => {
    const mockVerifications = [
      { questionId: 'q-1', isCorrect: true, fixApplied: false, verifiedAt: '2025-01-10T00:00:00Z' },
      { questionId: 'q-2', isCorrect: false, fixApplied: true, verifiedAt: '2025-01-12T00:00:00Z' },
      { questionId: 'q-3', isCorrect: true, fixApplied: false, verifiedAt: '2025-01-08T00:00:00Z' },
    ]

    // Standalone mock for getVerificationResultsByQuestionIds which uses .select().from().where().orderBy()
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(mockVerifications),
            }),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      aiVerificationResults: { questionId: 'question_id', verifiedAt: 'verified_at' },
    }))

    const { getVerificationResultsByQuestionIds } = require('@/lib/api/verify-articles/queries')
    const result = await getVerificationResultsByQuestionIds(['q-1', 'q-2', 'q-3'])

    expect(result).toHaveLength(3)
    expect(result[0].isCorrect).toBe(true)
    expect(result[1].fixApplied).toBe(true)
  })
})

// ============================================
// ROUTE LOGIC TESTS (summary calculation)
// ============================================

describe('Verify Articles - Verification Summaries - Route Logic', () => {
  it('should compute summary per article correctly', () => {
    // Simulate the route logic for building summaries
    const articleIdToNumber: Record<string, string> = {
      'art-1': '10',
      'art-2': '11',
    }

    const questionRows = [
      { id: 'q-1', primaryArticleId: 'art-1' },
      { id: 'q-2', primaryArticleId: 'art-1' },
      { id: 'q-3', primaryArticleId: 'art-1' },
      { id: 'q-4', primaryArticleId: 'art-2' },
      { id: 'q-5', primaryArticleId: 'art-2' },
    ]

    const verifications = [
      { questionId: 'q-1', isCorrect: true, fixApplied: false, verifiedAt: '2025-01-10T00:00:00Z' },
      { questionId: 'q-2', isCorrect: false, fixApplied: true, verifiedAt: '2025-01-12T00:00:00Z' },
      { questionId: 'q-3', isCorrect: false, fixApplied: false, verifiedAt: '2025-01-11T00:00:00Z' },
      { questionId: 'q-4', isCorrect: true, fixApplied: false, verifiedAt: '2025-01-15T00:00:00Z' },
      // q-5 has no verification
    ]

    const questionsByArticle: Record<string, string[]> = {}
    const questionIds: string[] = []
    questionRows.forEach(q => {
      const articleNumber = articleIdToNumber[q.primaryArticleId!]
      if (!articleNumber) return
      if (!questionsByArticle[articleNumber]) questionsByArticle[articleNumber] = []
      questionsByArticle[articleNumber].push(q.id)
      questionIds.push(q.id)
    })

    const verificationMap: Record<string, typeof verifications[0]> = {}
    const appliedFixes: Record<string, boolean> = {}
    for (const v of verifications) {
      if (!verificationMap[v.questionId!]) {
        verificationMap[v.questionId!] = v
      }
      if (v.fixApplied) {
        appliedFixes[v.questionId!] = true
      }
    }

    const articleNumbers = ['10', '11']
    const summaries: Record<string, { total: number; verified: number; ok: number; fixed: number; problems: number; lastVerifiedAt: string | null }> = {}

    for (const articleNumber of articleNumbers) {
      const articleQuestionIds = questionsByArticle[articleNumber] || []
      if (articleQuestionIds.length === 0) continue

      let ok = 0, fixed = 0, problems = 0, verified = 0
      let lastVerifiedAt: string | null = null

      for (const qId of articleQuestionIds) {
        const verification = verificationMap[qId]
        if (!verification) continue
        verified++

        if (verification.verifiedAt) {
          const date = new Date(verification.verifiedAt)
          if (!lastVerifiedAt || date > new Date(lastVerifiedAt)) {
            lastVerifiedAt = verification.verifiedAt
          }
        }

        if (verification.fixApplied || appliedFixes[qId]) {
          fixed++
        } else if (verification.isCorrect === true) {
          ok++
        } else if (verification.isCorrect === false) {
          problems++
        }
      }

      summaries[articleNumber] = { total: articleQuestionIds.length, verified, ok, fixed, problems, lastVerifiedAt }
    }

    // Article 10: 3 questions, q-1 ok, q-2 fixed, q-3 problem
    expect(summaries['10'].total).toBe(3)
    expect(summaries['10'].verified).toBe(3)
    expect(summaries['10'].ok).toBe(1)
    expect(summaries['10'].fixed).toBe(1)
    expect(summaries['10'].problems).toBe(1)
    expect(summaries['10'].lastVerifiedAt).toBe('2025-01-12T00:00:00Z')

    // Article 11: 2 questions, q-4 ok, q-5 not verified
    expect(summaries['11'].total).toBe(2)
    expect(summaries['11'].verified).toBe(1)
    expect(summaries['11'].ok).toBe(1)
    expect(summaries['11'].fixed).toBe(0)
    expect(summaries['11'].problems).toBe(0)
    expect(summaries['11'].lastVerifiedAt).toBe('2025-01-15T00:00:00Z')
  })

  it('should track appliedFixes across verifications', () => {
    const verifications = [
      { questionId: 'q-1', isCorrect: false, fixApplied: true, verifiedAt: '2025-01-10T00:00:00Z' },
      { questionId: 'q-2', isCorrect: false, fixApplied: false, verifiedAt: '2025-01-11T00:00:00Z' },
    ]

    const appliedFixes: Record<string, boolean> = {}
    for (const v of verifications) {
      if (v.fixApplied) {
        appliedFixes[v.questionId!] = true
      }
    }

    expect(appliedFixes['q-1']).toBe(true)
    expect(appliedFixes['q-2']).toBeUndefined()
  })

  it('should return empty summaries when no articles match', () => {
    const articleNumbers: string[] = ['999']
    const questionsByArticle: Record<string, string[]> = {}

    const summaries: Record<string, any> = {}
    for (const articleNumber of articleNumbers) {
      const articleQuestionIds = questionsByArticle[articleNumber] || []
      if (articleQuestionIds.length === 0) continue
      summaries[articleNumber] = {}
    }

    expect(Object.keys(summaries)).toHaveLength(0)
  })
})
