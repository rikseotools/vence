/**
 * Tests para admin-embedding-review: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  embeddingReviewActionSchema,
  embeddingReviewResponseSchema,
  embeddingReviewActionResponseSchema,
} from '@/lib/api/admin-embedding-review/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Embedding Review - Schemas', () => {
  describe('embeddingReviewActionSchema', () => {
    it('should accept mark_correct action', () => {
      const result = embeddingReviewActionSchema.safeParse({
        questionId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'mark_correct',
      })
      expect(result.success).toBe(true)
    })

    it('should accept needs_llm_review action', () => {
      const result = embeddingReviewActionSchema.safeParse({
        questionId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'needs_llm_review',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid action', () => {
      const result = embeddingReviewActionSchema.safeParse({
        questionId: '550e8400-e29b-41d4-a716-446655440000',
        action: 'delete',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID', () => {
      const result = embeddingReviewActionSchema.safeParse({
        questionId: 'not-a-uuid',
        action: 'mark_correct',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing fields', () => {
      expect(embeddingReviewActionSchema.safeParse({}).success).toBe(false)
      expect(embeddingReviewActionSchema.safeParse({ questionId: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(false)
    })
  })

  describe('embeddingReviewResponseSchema', () => {
    it('should accept valid response with questions', () => {
      const result = embeddingReviewResponseSchema.safeParse({
        success: true,
        questions: [{
          id: '550e8400-e29b-41d4-a716-446655440000',
          question_text: 'Test question',
          assigned_article: 'CE Art. 1',
          similarity: 85,
          suggested_article: 'CE Art. 2',
          suggested_similarity: 92,
          topics: [{ topic_id: '550e8400-e29b-41d4-a716-446655440001', topic_title: 'Tema 1', topic_number: 1, position: 1 }],
          verified_at: '2025-01-01T00:00:00Z',
          topic_review_status: null,
        }],
        stats: { total: 1, withTopic: 1, withoutTopic: 0 },
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty questions', () => {
      const result = embeddingReviewResponseSchema.safeParse({
        success: true,
        questions: [],
        stats: { total: 0, withTopic: 0, withoutTopic: 0 },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('embeddingReviewActionResponseSchema', () => {
    it('should accept success response', () => {
      const result = embeddingReviewActionResponseSchema.safeParse({
        success: true,
        message: 'Marcado como correcto',
      })
      expect(result.success).toBe(true)
    })

    it('should accept error response', () => {
      const result = embeddingReviewActionResponseSchema.safeParse({
        success: false,
        error: 'Faltan parámetros',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Embedding Review - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getFlaggedQuestions should return empty when no verifications', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      aiVerificationResults: {},
      questions: {},
      articles: {},
      laws: {},
      topicScope: {},
      topics: {},
    }))

    const { getFlaggedQuestions } = require('@/lib/api/admin-embedding-review/queries')
    const result = await getFlaggedQuestions()

    expect(result.questions).toHaveLength(0)
    expect(result.stats.total).toBe(0)
  })

  it('markCorrect should update verification and question', async () => {
    const mockUpdate = jest.fn().mockReturnValue({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    })

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        update: mockUpdate,
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      aiVerificationResults: { questionId: 'question_id', aiProvider: 'ai_provider' },
      questions: { id: 'id', topicReviewStatus: 'topic_review_status' },
    }))

    const { markCorrect } = require('@/lib/api/admin-embedding-review/queries')
    await markCorrect('550e8400-e29b-41d4-a716-446655440000')

    expect(mockUpdate).toHaveBeenCalledTimes(2)
  })
})
