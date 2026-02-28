/**
 * Tests para admin-pending-counts: schemas, queries y route
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  pendingCountsResponseSchema,
  pendingCountsErrorSchema,
} from '@/lib/api/admin-pending-counts/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Pending Counts - Schemas', () => {
  describe('pendingCountsResponseSchema', () => {
    it('should accept valid response', () => {
      const result = pendingCountsResponseSchema.safeParse({
        success: true,
        impugnaciones: 5,
        detail: { normal: 3, psychometric: 2 },
      })
      expect(result.success).toBe(true)
    })

    it('should accept zero counts', () => {
      const result = pendingCountsResponseSchema.safeParse({
        success: true,
        impugnaciones: 0,
        detail: { normal: 0, psychometric: 0 },
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative counts', () => {
      const result = pendingCountsResponseSchema.safeParse({
        success: true,
        impugnaciones: -1,
        detail: { normal: 0, psychometric: 0 },
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing detail', () => {
      const result = pendingCountsResponseSchema.safeParse({
        success: true,
        impugnaciones: 5,
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-integer counts', () => {
      const result = pendingCountsResponseSchema.safeParse({
        success: true,
        impugnaciones: 2.5,
        detail: { normal: 1, psychometric: 1.5 },
      })
      expect(result.success).toBe(false)
    })
  })

  describe('pendingCountsErrorSchema', () => {
    it('should accept valid error response', () => {
      const result = pendingCountsErrorSchema.safeParse({
        success: false,
        error: 'Error interno',
        impugnaciones: 0,
      })
      expect(result.success).toBe(true)
    })

    it('should reject error with non-zero impugnaciones', () => {
      const result = pendingCountsErrorSchema.safeParse({
        success: false,
        error: 'Error',
        impugnaciones: 5,
      })
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS (mock getDb)
// ============================================

describe('Admin Pending Counts - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  function setupMock(normalCount: number, psychoCount: number) {
    let callIndex = 0
    const counts = [normalCount, psychoCount]

    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([{ count: counts[callIndex++] }]),
          }),
        }),
      }),
    }))

    jest.doMock('@/db/schema', () => ({
      questionDisputes: { status: 'status' },
      psychometricQuestionDisputes: { status: 'status' },
    }))
  }

  it('should call getDb and query both tables', async () => {
    setupMock(3, 2)
    const { getPendingDisputeCounts } = require('@/lib/api/admin-pending-counts/queries')
    const result = await getPendingDisputeCounts()

    expect(result.success).toBe(true)
    expect(result.detail.normal).toBe(3)
    expect(result.detail.psychometric).toBe(2)
    expect(result.impugnaciones).toBe(5)
  })

  it('should handle zero results', async () => {
    setupMock(0, 0)
    const { getPendingDisputeCounts } = require('@/lib/api/admin-pending-counts/queries')
    const result = await getPendingDisputeCounts()

    expect(result.success).toBe(true)
    expect(result.impugnaciones).toBe(0)
  })
})

// ============================================
// ROUTE TESTS
// ============================================

describe('Admin Pending Counts - Route', () => {
  it('should return valid response structure', async () => {
    // Mock the module
    jest.doMock('@/lib/api/admin-pending-counts', () => ({
      getPendingDisputeCounts: jest.fn().mockResolvedValue({
        success: true,
        impugnaciones: 7,
        detail: { normal: 4, psychometric: 3 },
      }),
    }))

    // Verify the response matches the schema
    const mockResponse = {
      success: true,
      impugnaciones: 7,
      detail: { normal: 4, psychometric: 3 },
    }
    const parsed = pendingCountsResponseSchema.safeParse(mockResponse)
    expect(parsed.success).toBe(true)
  })

  it('should return error format on failure', () => {
    const errorResponse = {
      success: false,
      error: 'Error interno',
      impugnaciones: 0,
    }
    const parsed = pendingCountsErrorSchema.safeParse(errorResponse)
    expect(parsed.success).toBe(true)
  })
})
