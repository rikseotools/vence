/**
 * Tests para admin-delete-user: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  deleteUserRequestSchema,
  deleteUserResponseSchema,
  deleteUserErrorSchema,
} from '@/lib/api/admin-delete-user/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Delete User - Schemas', () => {
  describe('deleteUserRequestSchema', () => {
    it('should accept valid UUID userId', () => {
      const result = deleteUserRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000'
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing userId', () => {
      const result = deleteUserRequestSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID', () => {
      const result = deleteUserRequestSchema.safeParse({
        userId: 'not-a-uuid'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('deleteUserResponseSchema', () => {
    it('should accept valid response with deletion results', () => {
      const result = deleteUserResponseSchema.safeParse({
        success: true,
        message: 'Usuario eliminado correctamente',
        details: [
          { table: 'pwa_events', status: 'deleted' },
          { table: 'test_questions', status: 'skipped', reason: 'Table does not exist' },
          { table: 'auth.users', status: 'deleted' }
        ]
      })
      expect(result.success).toBe(true)
    })

    it('should accept response with error results', () => {
      const result = deleteUserResponseSchema.safeParse({
        success: true,
        message: 'Usuario eliminado correctamente',
        details: [
          { table: 'user_profiles', status: 'error', error: 'FK constraint' }
        ]
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid status value', () => {
      const result = deleteUserResponseSchema.safeParse({
        success: true,
        message: 'Test',
        details: [
          { table: 'test', status: 'unknown' }
        ]
      })
      expect(result.success).toBe(false)
    })
  })

  describe('deleteUserErrorSchema', () => {
    it('should accept valid error response', () => {
      const result = deleteUserErrorSchema.safeParse({
        success: false,
        error: 'userId es requerido'
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Delete User - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should execute cascading deletes for all tables', async () => {
    const executeMock = jest.fn().mockResolvedValue(undefined)

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        execute: executeMock
      })
    }))

    jest.doMock('drizzle-orm', () => ({
      sql: { raw: (str: string) => str }
    }))

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    expect(result.length).toBe(21) // 21 tables
    expect(result.every((r: any) => r.status === 'deleted')).toBe(true)
    expect(executeMock).toHaveBeenCalledTimes(21)
  })

  it('should handle table not found errors gracefully', async () => {
    const executeMock = jest.fn()
      .mockRejectedValueOnce(new Error('relation "pwa_events" does not exist'))
      .mockResolvedValue(undefined)

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        execute: executeMock
      })
    }))

    jest.doMock('drizzle-orm', () => ({
      sql: { raw: (str: string) => str }
    }))

    const { deleteUserData } = require('@/lib/api/admin-delete-user/queries')
    const result = await deleteUserData('550e8400-e29b-41d4-a716-446655440000')

    // First table should be skipped (error message contains "does not exist")
    expect(result[0].status).toBe('skipped')
    expect(result.length).toBe(21)
  })
})
