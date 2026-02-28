/**
 * Tests para newsletters/users: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  newsletterUsersQuerySchema,
  newsletterUsersResponseSchema,
} from '@/lib/api/newsletters/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Newsletter Users - Schemas', () => {
  describe('newsletterUsersQuerySchema', () => {
    it('should accept defaults', () => {
      const result = newsletterUsersQuerySchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.audienceType).toBe('all')
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(50)
        expect(result.data.search).toBe('')
      }
    })

    it('should accept valid audience types', () => {
      for (const type of ['all', 'active', 'inactive', 'premium', 'free']) {
        const result = newsletterUsersQuerySchema.safeParse({ audienceType: type })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid audience type', () => {
      const result = newsletterUsersQuerySchema.safeParse({ audienceType: 'invalid' })
      expect(result.success).toBe(false)
    })

    it('should coerce string page to number', () => {
      const result = newsletterUsersQuerySchema.safeParse({ page: '3' })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(3)
      }
    })

    it('should reject page < 1', () => {
      const result = newsletterUsersQuerySchema.safeParse({ page: 0 })
      expect(result.success).toBe(false)
    })

    it('should reject limit > 200', () => {
      const result = newsletterUsersQuerySchema.safeParse({ limit: 500 })
      expect(result.success).toBe(false)
    })
  })

  describe('newsletterUsersResponseSchema', () => {
    it('should accept valid response', () => {
      const result = newsletterUsersResponseSchema.safeParse({
        success: true,
        users: [{
          id: '550e8400-e29b-41d4-a716-446655440000',
          email: 'test@test.com',
          fullName: 'Test',
          createdAt: '2025-01-01'
        }],
        pagination: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
          hasMore: false
        },
        audienceType: 'all',
        search: ''
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty users', () => {
      const result = newsletterUsersResponseSchema.safeParse({
        success: true,
        users: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0,
          hasMore: false
        },
        audienceType: 'premium',
        search: 'test'
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Newsletter Users - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should query user_profiles for audienceType=all', async () => {
    const mockUsers = [
      { id: 'u1', email: 'a@test.com', fullName: 'A', createdAt: '2025-01-01' },
      { id: 'u2', email: 'b@test.com', fullName: 'B', createdAt: '2025-01-02' },
    ]

    let selectCallIndex = 0
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => {
          selectCallIndex++
          if (selectCallIndex === 1) {
            // First call: count query
            return {
              from: () => ({
                where: () => Promise.resolve([{ count: 2 }])
              })
            }
          }
          // Second call: data query
          return {
            from: () => ({
              where: () => ({
                orderBy: () => ({
                  limit: () => ({
                    offset: () => Promise.resolve(mockUsers)
                  })
                })
              })
            })
          }
        }
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: { id: 'id', email: 'email', fullName: 'full_name', createdAt: 'created_at' },
      emailPreferences: { userId: 'user_id', unsubscribedAll: 'unsubscribed_all' },
      emailEvents: {},
      adminUsersWithRoles: {}
    }))

    const { getNewsletterUsers } = require('@/lib/api/newsletters/queries')
    const result = await getNewsletterUsers('all', '', 1, 50)

    expect(result.success).toBe(true)
    expect(result.audienceType).toBe('all')
    expect(result.users.length).toBe(2)
    expect(result.pagination.total).toBe(2)
  })
})
