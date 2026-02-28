/**
 * Tests para admin-ai-chat-logs: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  aiChatLogsQuerySchema,
  aiChatLogsResponseSchema,
  aiChatLogsErrorSchema,
} from '@/lib/api/admin-ai-chat-logs/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin AI Chat Logs - Schemas', () => {
  describe('aiChatLogsQuerySchema', () => {
    it('should accept valid query params', () => {
      const result = aiChatLogsQuerySchema.safeParse({
        page: '2',
        limit: '50',
        feedback: 'positive'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(2)
        expect(result.data.limit).toBe(50)
        expect(result.data.feedback).toBe('positive')
      }
    })

    it('should use defaults for missing params', () => {
      const result = aiChatLogsQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(20)
        expect(result.data.feedback).toBeUndefined()
      }
    })

    it('should accept all feedback filter values', () => {
      for (const feedback of ['positive', 'negative', 'none', 'all']) {
        const result = aiChatLogsQuerySchema.safeParse({ feedback })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid feedback value', () => {
      const result = aiChatLogsQuerySchema.safeParse({
        feedback: 'invalid'
      })
      expect(result.success).toBe(false)
    })

    it('should reject page less than 1', () => {
      const result = aiChatLogsQuerySchema.safeParse({
        page: '0'
      })
      expect(result.success).toBe(false)
    })

    it('should reject limit over 100', () => {
      const result = aiChatLogsQuerySchema.safeParse({
        limit: '101'
      })
      expect(result.success).toBe(false)
    })

    it('should coerce string numbers', () => {
      const result = aiChatLogsQuerySchema.safeParse({
        page: '3',
        limit: '10'
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(typeof result.data.page).toBe('number')
        expect(typeof result.data.limit).toBe('number')
      }
    })
  })

  describe('aiChatLogsResponseSchema', () => {
    it('should accept valid response', () => {
      const result = aiChatLogsResponseSchema.safeParse({
        success: true,
        logs: [{
          id: '550e8400-e29b-41d4-a716-446655440000',
          user_id: '660e8400-e29b-41d4-a716-446655440000',
          message: 'Test question',
          response_preview: 'Test preview',
          full_response: 'Full response',
          sources_used: [],
          question_context_id: null,
          question_context_law: null,
          suggestion_used: null,
          response_time_ms: 1500,
          tokens_used: 500,
          had_error: false,
          error_message: null,
          feedback: 'positive',
          feedback_comment: null,
          detected_laws: ['TREBEP'],
          created_at: '2026-01-01T00:00:00Z',
          user: { id: '660e8400-e29b-41d4-a716-446655440000', display_name: 'Test User', email: 'test@example.com' }
        }],
        stats: {
          total: 100,
          positive: 20,
          negative: 5,
          noFeedback: 75,
          errors: 2,
          avgResponseTime: 1200,
          satisfactionRate: 80
        },
        topSuggestions: [
          { name: 'Explica este artículo', count: 15 }
        ],
        topLaws: [
          { name: 'TREBEP', count: 30 }
        ],
        pagination: {
          page: 1,
          limit: 20,
          hasMore: true
        }
      })
      expect(result.success).toBe(true)
    })

    it('should accept response with empty logs', () => {
      const result = aiChatLogsResponseSchema.safeParse({
        success: true,
        logs: [],
        stats: {
          total: 0,
          positive: 0,
          negative: 0,
          noFeedback: 0,
          errors: 0,
          avgResponseTime: 0,
          satisfactionRate: null
        },
        topSuggestions: [],
        topLaws: [],
        pagination: { page: 1, limit: 20, hasMore: false }
      })
      expect(result.success).toBe(true)
    })
  })

  describe('aiChatLogsErrorSchema', () => {
    it('should accept valid error response', () => {
      const result = aiChatLogsErrorSchema.safeParse({
        success: false,
        error: 'Error interno'
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin AI Chat Logs - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should return paginated logs with stats', async () => {
    const mockLogs = [
      { id: 'log1', userId: 'u1', message: 'Q1', responsePreview: 'A1', fullResponse: 'Full A1',
        sourcesUsed: [], questionContextId: null, questionContextLaw: null, suggestionUsed: 'tip1',
        responseTimeMs: 1000, tokensUsed: 100, hadError: false, errorMessage: null,
        feedback: 'positive', feedbackComment: null, detectedLaws: ['TREBEP'], createdAt: '2026-01-01' },
      { id: 'log2', userId: 'u2', message: 'Q2', responsePreview: 'A2', fullResponse: 'Full A2',
        sourcesUsed: [], questionContextId: null, questionContextLaw: null, suggestionUsed: null,
        responseTimeMs: 2000, tokensUsed: 200, hadError: false, errorMessage: null,
        feedback: null, feedbackComment: null, detectedLaws: [], createdAt: '2026-01-02' }
    ]

    // Track calls to distinguish which table is being queried
    let selectCallCount = 0
    const chainable = {
      from: () => chainable,
      where: () => chainable,
      orderBy: () => chainable,
      offset: () => chainable,
      limit: () => Promise.resolve(mockLogs),
      then: (resolve: any) => resolve(mockLogs)
    }

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => {
          selectCallCount++
          return {
            from: () => {
              // Make the object both thenable (for direct await) and chainable
              const result: any = Promise.resolve(
                selectCallCount <= 1
                  ? [{ feedback: 'positive', hadError: false }, { feedback: null, hadError: false }]
                  : selectCallCount <= 2
                  ? mockLogs
                  : selectCallCount <= 4
                  ? [{ suggestionUsed: 'tip1' }]
                  : [{ detectedLaws: ['TREBEP'] }]
              )
              result.orderBy = () => ({
                offset: () => ({
                  limit: () => Promise.resolve(mockLogs)
                })
              })
              result.where = () => ({
                orderBy: () => ({
                  offset: () => ({
                    limit: () => Promise.resolve(mockLogs)
                  })
                }),
                then: (resolve: any) => resolve([{ id: 'u1', fullName: 'User 1', email: 'u1@test.com' }])
              })
              return result
            }
          }
        }
      })
    }))

    jest.doMock('@/db/schema', () => ({
      aiChatLogs: {
        id: 'id', userId: 'user_id', message: 'message', responsePreview: 'response_preview',
        fullResponse: 'full_response', sourcesUsed: 'sources_used', questionContextId: 'question_context_id',
        questionContextLaw: 'question_context_law', suggestionUsed: 'suggestion_used',
        responseTimeMs: 'response_time_ms', tokensUsed: 'tokens_used', hadError: 'had_error',
        errorMessage: 'error_message', feedback: 'feedback', feedbackComment: 'feedback_comment',
        detectedLaws: 'detected_laws', createdAt: 'created_at'
      },
      userProfiles: { id: 'id', fullName: 'full_name', email: 'email' }
    }))

    jest.doMock('drizzle-orm', () => ({
      desc: () => 'desc',
      eq: () => 'eq',
      isNull: () => 'isNull',
      isNotNull: () => 'isNotNull',
      inArray: () => 'inArray'
    }))

    const { getAiChatLogs } = require('@/lib/api/admin-ai-chat-logs/queries')
    const result = await getAiChatLogs(1, 20)

    expect(result.success).toBe(true)
    expect(result.logs.length).toBe(2)
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.limit).toBe(20)
  })
})
