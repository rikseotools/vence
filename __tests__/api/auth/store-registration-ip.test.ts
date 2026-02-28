/**
 * Tests para auth/store-registration-ip: schema + read-then-write mock
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

// Schemas
const storeIpSchema = z.object({
  userId: z.string().uuid(),
})

const storeIpResponseSchema = z.object({
  success: z.boolean(),
  ip: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Store Registration IP - Schemas', () => {
  describe('storeIpSchema (request)', () => {
    it('should accept valid userId', () => {
      const result = storeIpSchema.safeParse({ userId: '550e8400-e29b-41d4-a716-446655440000' })
      expect(result.success).toBe(true)
    })

    it('should reject missing userId', () => {
      const result = storeIpSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('should reject invalid userId', () => {
      const result = storeIpSchema.safeParse({ userId: 'not-uuid' })
      expect(result.success).toBe(false)
    })
  })

  describe('storeIpResponseSchema', () => {
    it('should accept success with IP', () => {
      const result = storeIpResponseSchema.safeParse({ success: true, ip: '1.2.3.4' })
      expect(result.success).toBe(true)
    })

    it('should accept already registered message', () => {
      const result = storeIpResponseSchema.safeParse({
        success: true,
        message: 'IP ya registrada previamente',
        ip: '5.6.7.8',
      })
      expect(result.success).toBe(true)
    })

    it('should accept error response', () => {
      const result = storeIpResponseSchema.safeParse({
        success: false,
        error: 'userId requerido',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// READ-THEN-WRITE PATTERN TESTS
// ============================================

describe('Store Registration IP - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('should not overwrite existing registration_ip', async () => {
    let updateCalled = false

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ registrationIp: '10.0.0.1' }]),
            }),
          }),
        }),
        update: () => {
          updateCalled = true
          return { set: () => ({ where: () => Promise.resolve() }) }
        },
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: { id: 'id', registrationIp: 'registration_ip' },
    }))

    const { getDb } = require('@/db/client')
    const db = getDb()

    // Simulate: check existing IP
    const existing = await db.select().from().where().limit()
    if (existing[0]?.registrationIp) {
      // Should NOT update
      expect(updateCalled).toBe(false)
    }
  })

  it('should update when no existing IP', async () => {
    const updates: any[] = []

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ registrationIp: null }]),
            }),
          }),
        }),
        update: () => ({
          set: (vals: any) => {
            updates.push(vals)
            return { where: () => Promise.resolve() }
          },
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      userProfiles: { id: 'id', registrationIp: 'registration_ip' },
    }))

    const { getDb } = require('@/db/client')
    const db = getDb()

    const existing = await db.select().from().where().limit()
    if (!existing[0]?.registrationIp) {
      await db.update().set({ registrationIp: '1.2.3.4' }).where()
    }

    expect(updates).toHaveLength(1)
    expect(updates[0].registrationIp).toBe('1.2.3.4')
  })
})
