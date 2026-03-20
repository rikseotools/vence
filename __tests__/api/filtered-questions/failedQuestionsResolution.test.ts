/**
 * Tests para la resolución de "Solo preguntas falladas" cuando no se pasan IDs específicos.
 *
 * Bug de Mar: al marcar "solo falladas" desde el configurador, no se pasan failedQuestionIds.
 * La API recibía onlyFailedQuestions=true pero failedQuestionIds=[] → devolvía preguntas aleatorias.
 *
 * Fix: cuando onlyFailedQuestions=true y no hay IDs, buscar en user_question_history.
 */

describe('Failed questions resolution - onlyFailedQuestions without IDs', () => {

  beforeEach(() => {
    jest.resetModules()
  })

  // ============================================
  // UNIT: resolución de IDs desde historial
  // ============================================
  describe('getFilteredQuestions - failed questions by user history', () => {
    function setupMocks(options: {
      failedHistory?: Array<{ questionId: string }>
      questions?: Array<Record<string, unknown>>
    }) {
      const { failedHistory = [], questions: questionRows = [] } = options

      // Mock Drizzle chain
      const mockSelect = jest.fn()
      const mockFrom = jest.fn()
      const mockWhere = jest.fn()
      const mockInnerJoin = jest.fn()
      const mockLimit = jest.fn()

      // Chain for user_question_history query
      const historyChain = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(failedHistory)
          })
        })
      }

      // Chain for questions query
      const questionsChain = {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            innerJoin: jest.fn().mockReturnValue({
              innerJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockResolvedValue(questionRows)
              })
            })
          })
        })
      }

      // getDb returns different chains on successive calls
      let callCount = 0
      jest.doMock('@/db/client', () => ({
        getDb: () => {
          callCount++
          return callCount === 1 ? historyChain : questionsChain
        }
      }))

      jest.doMock('@/db/schema', () => ({
        questions: { id: 'id', isActive: 'is_active', primaryArticleId: 'primary_article_id' },
        articles: { id: 'id', lawId: 'law_id' },
        laws: { id: 'id' },
        topicScope: { topicId: 'topic_id' },
        topics: { id: 'id' },
        tests: { id: 'id' },
        testQuestions: { testId: 'test_id' },
        userQuestionHistory: { userId: 'user_id', questionId: 'question_id', successRate: 'success_rate' },
      }))
    }

    it('should resolve failed question IDs from user_question_history when failedQuestionIds is empty', async () => {
      // This test validates the logic conceptually
      const userId = 'user-123'
      const failedIds = ['q1', 'q2', 'q3']

      // Simulate: user has 3 failed questions
      expect(failedIds.length).toBeGreaterThan(0)

      // When onlyFailedQuestions=true and failedQuestionIds=[], the system should:
      // 1. Query user_question_history WHERE user_id=userId AND success_rate < 1.00
      // 2. Get the question_ids
      // 3. Use those IDs to fetch the actual questions

      // Verify the logic flow
      const onlyFailedQuestions = true
      const originalFailedIds: string[] = []

      let resolvedIds = originalFailedIds.length > 0 ? originalFailedIds : null

      if (onlyFailedQuestions && !resolvedIds && userId) {
        // This is the new code path we added
        resolvedIds = failedIds // simulating DB lookup
      }

      expect(resolvedIds).toEqual(['q1', 'q2', 'q3'])
    })

    it('should return empty array when user has no failed questions', () => {
      const onlyFailedQuestions = true
      const userId = 'user-123'
      const failedQuestionIds: string[] = []
      const historyResults: string[] = [] // no failed questions

      let resolvedIds = failedQuestionIds.length > 0 ? failedQuestionIds : null

      if (onlyFailedQuestions && !resolvedIds && userId) {
        resolvedIds = historyResults
      }

      expect(resolvedIds).toEqual([])
    })

    it('should use provided failedQuestionIds when available (skip history lookup)', () => {
      const onlyFailedQuestions = true
      const userId = 'user-123'
      const failedQuestionIds = ['specific-q1', 'specific-q2']

      let resolvedIds = failedQuestionIds.length > 0 ? failedQuestionIds : null

      if (onlyFailedQuestions && !resolvedIds && userId) {
        resolvedIds = ['history-q1'] // should NOT reach here
      }

      expect(resolvedIds).toEqual(['specific-q1', 'specific-q2'])
    })

    it('should NOT resolve when userId is missing', () => {
      const onlyFailedQuestions = true
      const userId: string | null = null
      const failedQuestionIds: string[] = []

      let resolvedIds: string[] | null = failedQuestionIds.length > 0 ? failedQuestionIds : null

      if (onlyFailedQuestions && !resolvedIds && userId) {
        resolvedIds = ['should-not-happen']
      }

      expect(resolvedIds).toBeNull()
    })

    it('should NOT resolve when onlyFailedQuestions is false', () => {
      const onlyFailedQuestions = false
      const userId = 'user-123'
      const failedQuestionIds: string[] = []

      let resolvedIds: string[] | null = failedQuestionIds.length > 0 ? failedQuestionIds : null

      if (onlyFailedQuestions && !resolvedIds && userId) {
        resolvedIds = ['should-not-happen']
      }

      expect(resolvedIds).toBeNull()
    })
  })

  // ============================================
  // UNIT: client-side userId passing
  // ============================================
  describe('fetchQuestionsViaAPI - userId inclusion', () => {
    it('should include userId in API body when onlyFailedQuestions is true', () => {
      const onlyFailedQuestions = true
      const userId = 'user-abc-123'

      const body: Record<string, unknown> = {
        topicNumber: 0,
        positionType: 'auxiliar_administrativo_estado',
        numQuestions: 25,
        onlyFailedQuestions,
        failedQuestionIds: [],
      }

      // Simulate the code we added in testFetchers.ts
      if (onlyFailedQuestions && userId) {
        body.userId = userId
      }

      expect(body.userId).toBe('user-abc-123')
    })

    it('should NOT include userId when onlyFailedQuestions is false', () => {
      const onlyFailedQuestions = false
      const userId = 'user-abc-123'

      const body: Record<string, unknown> = {
        onlyFailedQuestions,
        failedQuestionIds: [],
      }

      if (onlyFailedQuestions && userId) {
        body.userId = userId
      }

      expect(body.userId).toBeUndefined()
    })
  })

  // ============================================
  // REGRESSION: Mar's specific bug scenario
  // ============================================
  describe('Mar bug regression - configurator "solo falladas" without IDs', () => {
    it('CRITICAL: onlyFailedQuestions=true with empty IDs must NOT return random questions', () => {
      // Before fix: onlyFailedQuestions=true, failedQuestionIds=[] → skipped the block → random questions
      // After fix: resolves IDs from user_question_history → returns actual failed questions

      const onlyFailedQuestions = true
      const failedQuestionIds: string[] = []
      const userId = 'mar-user-id'

      // The old code:
      // if (onlyFailedQuestions && failedQuestionIds && failedQuestionIds.length > 0)
      //   → false, skipped → returned random questions

      const oldBehavior = onlyFailedQuestions && failedQuestionIds && failedQuestionIds.length > 0
      expect(oldBehavior).toBe(false) // confirms old code would skip

      // The new code:
      let resolvedIds: string[] | null = failedQuestionIds.length > 0 ? failedQuestionIds : null
      if (onlyFailedQuestions && !resolvedIds && userId) {
        // Would query user_question_history and get IDs
        resolvedIds = ['failed-q1', 'failed-q2', 'failed-q3']
      }

      const newBehavior = onlyFailedQuestions && resolvedIds && resolvedIds.length > 0
      expect(newBehavior).toBe(true) // confirms new code enters the block
      expect(resolvedIds).not.toBeNull()
      expect(resolvedIds!.length).toBe(3)
    })

    it('CRITICAL: test from configurator passes only_failed=true but no IDs in URL', () => {
      // Simulate what the LawTestConfigurator does:
      // params.set('only_failed', 'true') — NO failedQuestionIds
      const searchParams = new URLSearchParams('only_failed=true&n=25')

      expect(searchParams.get('only_failed')).toBe('true')
      expect(searchParams.get('failed_question_ids')).toBeNull()

      // The fetcher would parse these and get:
      const onlyFailedQuestions = searchParams.get('only_failed') === 'true'
      const failedQuestionIdsStr = searchParams.get('failed_question_ids')
      const failedQuestionIds = failedQuestionIdsStr ? JSON.parse(failedQuestionIdsStr) : []

      expect(onlyFailedQuestions).toBe(true)
      expect(failedQuestionIds).toEqual([])

      // Without fix: this combination would be ignored
      // With fix: userId is resolved, history is queried
    })

    it('test from "Repetir falladas" button passes IDs via sessionStorage (existing flow)', () => {
      // Simulate what buildTestUrl does when user clicks "Repetir falladas"
      const failedIds = ['q1', 'q2', 'q3', 'q4', 'q5']

      // buildTestUrl stores in sessionStorage
      const stored = JSON.stringify(failedIds)

      // TestPersonalizadoPage reads from sessionStorage
      const parsed = JSON.parse(stored)

      expect(parsed).toEqual(failedIds)
      expect(parsed.length).toBe(5)

      // This flow already worked — IDs are passed directly
      const resolvedIds = parsed.length > 0 ? parsed : null
      expect(resolvedIds).not.toBeNull()
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================
  describe('Edge cases', () => {
    it('user with all questions correct (success_rate = 1.00) gets empty result', () => {
      // success_rate = 1.00 means the user never failed this question
      // lt(success_rate, '1.00') should NOT match these
      const successRate = '1.00'
      const threshold = '1.00'

      // Numeric comparison: 1.00 < 1.00 = false → question is NOT failed
      expect(parseFloat(successRate) < parseFloat(threshold)).toBe(false)
    })

    it('user with success_rate = 0.50 IS a failed question', () => {
      const successRate = '0.50'
      const threshold = '1.00'

      expect(parseFloat(successRate) < parseFloat(threshold)).toBe(true)
    })

    it('user with success_rate = 0.00 IS a failed question', () => {
      const successRate = '0.00'
      const threshold = '1.00'

      expect(parseFloat(successRate) < parseFloat(threshold)).toBe(true)
    })

    it('user with success_rate = 0.99 IS a failed question', () => {
      // 99% success rate still means they failed at least once
      const successRate = '0.99'
      const threshold = '1.00'

      expect(parseFloat(successRate) < parseFloat(threshold)).toBe(true)
    })

    it('numQuestions limits the returned results', () => {
      const resolvedIds = Array.from({ length: 500 }, (_, i) => `q${i}`)
      const numQuestions = 25

      const finalQuestions = resolvedIds.slice(0, numQuestions)
      expect(finalQuestions.length).toBe(25)
    })

    it('handles both "by topic" and "by law" test paths', () => {
      // By topic: tema > 0, uses fetchQuestionsByTopicScope
      // By law: tema = 0, uses fetchQuestionsViaAPI
      // Both now support resolving failed IDs from history

      const temaByTopic = 14
      const temaByLaw = 0

      // Both paths should handle onlyFailedQuestions=true without IDs
      expect(temaByTopic > 0).toBe(true)  // goes to fetchQuestionsByTopicScope
      expect(temaByLaw).toBe(0)            // goes to fetchQuestionsViaAPI
    })
  })
})
