/**
 * Tests para verification-queue: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { verificationQueuePostSchema } from '@/lib/api/verify-articles/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Verification Queue - Schema', () => {
  describe('verificationQueuePostSchema', () => {
    const validUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const validUuid2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
    const validUuid3 = 'c3d4e5f6-a7b8-9012-cdef-123456789012'

    it('should accept valid with all fields', () => {
      const result = verificationQueuePostSchema.safeParse({
        topic_id: validUuid,
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        question_ids: [validUuid2, validUuid3],
      })
      expect(result.success).toBe(true)
    })

    it('should accept minimal (only topic_id)', () => {
      const result = verificationQueuePostSchema.safeParse({
        topic_id: validUuid,
      })
      expect(result.success).toBe(true)
    })

    it('should default provider to openai', () => {
      const result = verificationQueuePostSchema.safeParse({
        topic_id: validUuid,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('openai')
      }
    })

    it('should default model to gpt-4o-mini', () => {
      const result = verificationQueuePostSchema.safeParse({
        topic_id: validUuid,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model).toBe('gpt-4o-mini')
      }
    })

    it('should accept with question_ids', () => {
      const result = verificationQueuePostSchema.safeParse({
        topic_id: validUuid,
        question_ids: [validUuid2],
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.question_ids).toHaveLength(1)
      }
    })

    it('should accept without question_ids (optional)', () => {
      const result = verificationQueuePostSchema.safeParse({
        topic_id: validUuid,
        provider: 'openai',
        model: 'gpt-4o',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.question_ids).toBeUndefined()
      }
    })

    it('should reject missing topic_id', () => {
      const result = verificationQueuePostSchema.safeParse({
        provider: 'openai',
        model: 'gpt-4o-mini',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID topic_id', () => {
      const result = verificationQueuePostSchema.safeParse({
        topic_id: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-UUID question_ids', () => {
      const result = verificationQueuePostSchema.safeParse({
        topic_id: validUuid,
        question_ids: ['not-a-uuid', 'also-not-uuid'],
      })
      expect(result.success).toBe(false)
    })

    it('should accept custom provider string', () => {
      const result = verificationQueuePostSchema.safeParse({
        topic_id: validUuid,
        provider: 'google',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.provider).toBe('google')
      }
    })

    it('should accept custom model string', () => {
      const result = verificationQueuePostSchema.safeParse({
        topic_id: validUuid,
        model: 'gemini-1.5-flash',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.model).toBe('gemini-1.5-flash')
      }
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Verification Queue - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getVerificationQueueEntries should return entries array', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([
                  { id: 'entry-1', topicId: 'topic-1', status: 'pending' },
                  { id: 'entry-2', topicId: 'topic-2', status: 'processing' },
                ]),
              }),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      verificationQueue: { topicId: 'topic_id', status: 'status', createdAt: 'created_at' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { getVerificationQueueEntries } = require('@/lib/api/verify-articles/queries')
    const result = await getVerificationQueueEntries({})
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('getTopicById should return topic or null', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([
                { id: 'topic-id', title: 'Tema 1: Constitución', topicNumber: 1 },
              ]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      topics: { id: 'id', title: 'title', topicNumber: 'topic_number' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { getTopicById } = require('@/lib/api/verify-articles/queries')
    const result = await getTopicById('topic-id')
    expect(result).toBeDefined()
    expect(result.title).toBe('Tema 1: Constitución')
    expect(result.topicNumber).toBe(1)
  })

  it('getExistingQueueEntry should return entry or null', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([
                { id: 'queue-entry-1', status: 'pending' },
              ]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      verificationQueue: { id: 'id', topicId: 'topic_id', status: 'status' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { getExistingQueueEntry } = require('@/lib/api/verify-articles/queries')
    const result = await getExistingQueueEntry('topic-id')
    expect(result).toBeDefined()
    expect(result.status).toBe('pending')
  })

  it('getExistingQueueEntry should return null when no entry', async () => {
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
      verificationQueue: { id: 'id', topicId: 'topic_id', status: 'status' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { getExistingQueueEntry } = require('@/lib/api/verify-articles/queries')
    const result = await getExistingQueueEntry('nonexistent-topic')
    expect(result).toBeNull()
  })

  it('insertQueueEntry should return inserted entry', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        insert: () => ({
          values: () => ({
            returning: () => Promise.resolve([
              { id: 'new-entry', topicId: 'topic-id', status: 'pending', totalQuestions: 10 },
            ]),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      verificationQueue: { id: 'id', topicId: 'topic_id', status: 'status' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { insertQueueEntry } = require('@/lib/api/verify-articles/queries')
    const result = await insertQueueEntry({
      topicId: 'topic-id',
      aiProvider: 'openai',
      aiModel: 'gpt-4o-mini',
      questionIds: ['q1', 'q2'],
      totalQuestions: 2,
      status: 'pending',
    })
    expect(result).toBeDefined()
    expect(result.status).toBe('pending')
  })

  it('cancelQueueEntry should return cancelled entry or null', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () => Promise.resolve([
                { id: 'entry-1', status: 'cancelled' },
              ]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      verificationQueue: { id: 'id', status: 'status' },
    }))
    jest.doMock('drizzle-orm', () => ({
      eq: jest.fn(),
      and: jest.fn(),
      inArray: jest.fn(),
      desc: jest.fn(),
      sql: jest.fn(),
    }))

    const { cancelQueueEntry } = require('@/lib/api/verify-articles/queries')
    const result = await cancelQueueEntry('entry-1')
    expect(result).toBeDefined()
    expect(result.status).toBe('cancelled')
  })
})
