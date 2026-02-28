/**
 * Tests para admin-force-reactivation: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  forceReactivationRequestSchema,
  forceReactivationResponseSchema,
  forceReactivationErrorSchema,
} from '@/lib/api/admin-force-reactivation/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Force Reactivation - Schemas', () => {
  describe('forceReactivationRequestSchema', () => {
    it('should accept valid request with all fields', () => {
      const result = forceReactivationRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        userEmail: 'test@example.com',
        forcedBy: 'admin@vencemitfg.es'
      })
      expect(result.success).toBe(true)
    })

    it('should accept request without forcedBy', () => {
      const result = forceReactivationRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        userEmail: 'test@example.com'
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing userId', () => {
      const result = forceReactivationRequestSchema.safeParse({
        userEmail: 'test@example.com'
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing userEmail', () => {
      const result = forceReactivationRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000'
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid email', () => {
      const result = forceReactivationRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        userEmail: 'not-an-email'
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid UUID', () => {
      const result = forceReactivationRequestSchema.safeParse({
        userId: 'not-a-uuid',
        userEmail: 'test@example.com'
      })
      expect(result.success).toBe(false)
    })
  })

  describe('forceReactivationResponseSchema', () => {
    it('should accept valid response', () => {
      const result = forceReactivationResponseSchema.safeParse({
        success: true,
        message: 'Prompt de reactivación forzado exitosamente para test@example.com',
        details: {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          userEmail: 'test@example.com',
          action: 'Configuration reset to force reactivation prompt',
          forcedBy: 'admin@vencemitfg.es',
          timestamp: '2026-01-01T00:00:00.000Z',
          nextStep: 'User will see activation prompt on next app visit'
        }
      })
      expect(result.success).toBe(true)
    })
  })

  describe('forceReactivationErrorSchema', () => {
    it('should accept valid error response', () => {
      const result = forceReactivationErrorSchema.safeParse({
        error: 'Usuario no encontrado'
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Force Reactivation - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should verify user, upsert settings, and insert event', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{
                id: '550e8400-e29b-41d4-a716-446655440000',
                email: 'test@example.com',
                fullName: 'Test User'
              }])
            })
          })
        }),
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: jest.fn().mockResolvedValue(undefined)
          })
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: { id: 'id', email: 'email', fullName: 'full_name' },
      userNotificationSettings: { userId: 'user_id' },
      notificationEvents: {}
    }))

    const { forceReactivationPrompt } = require('@/lib/api/admin-force-reactivation/queries')
    const result = await forceReactivationPrompt(
      '550e8400-e29b-41d4-a716-446655440000',
      'test@example.com',
      'admin@vencemitfg.es'
    )

    expect(result.success).toBe(true)
    expect(result.details.userId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(result.details.userEmail).toBe('test@example.com')
  })

  it('should throw USER_NOT_FOUND when user does not exist', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([])
            })
          })
        })
      })
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: { id: 'id', email: 'email', fullName: 'full_name' },
      userNotificationSettings: { userId: 'user_id' },
      notificationEvents: {}
    }))

    const { forceReactivationPrompt } = require('@/lib/api/admin-force-reactivation/queries')

    await expect(forceReactivationPrompt(
      '550e8400-e29b-41d4-a716-446655440000',
      'test@example.com'
    )).rejects.toThrow('USER_NOT_FOUND')
  })
})
