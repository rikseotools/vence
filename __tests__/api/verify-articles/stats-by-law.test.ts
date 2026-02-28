/**
 * Tests para verify-articles/stats-by-law: calculateIsOk helper y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { calculateIsOk } from '@/lib/api/verify-articles/ai-helpers'

// ============================================
// HELPER TESTS
// ============================================

describe('Verify Articles - Stats By Law', () => {
  describe('calculateIsOk', () => {
    it('should return false for null summary', () => {
      expect(calculateIsOk(null)).toBe(false)
    })

    it('should return true for no_consolidated_text flag', () => {
      expect(calculateIsOk({ no_consolidated_text: true })).toBe(true)
    })

    it('should return false for boe_count=0', () => {
      expect(calculateIsOk({ boe_count: 0 })).toBe(false)
    })

    it('should return false for total_boe=0', () => {
      expect(calculateIsOk({ total_boe: 0 })).toBe(false)
    })

    it('should return false when message contains "No se encontraron articulos"', () => {
      expect(calculateIsOk({ message: 'No se encontraron artículos en el BOE', boe_count: 5 })).toBe(false)
    })

    it('should return true for all zero mismatches', () => {
      expect(calculateIsOk({
        title_mismatch: 0,
        content_mismatch: 0,
        extra_in_db: 0,
        missing_in_db: 0,
        boe_count: 10,
      })).toBe(true)
    })

    it('should return true for empty object (no mismatches, no boe_count)', () => {
      // Empty object: boe_count is undefined (not 0), so boeCount check passes (null !== 0)
      // All mismatches default to 0
      expect(calculateIsOk({})).toBe(true)
    })

    it('should return false when title_mismatch > 0', () => {
      expect(calculateIsOk({ title_mismatch: 1, boe_count: 5 })).toBe(false)
    })

    it('should return false when content_mismatch > 0', () => {
      expect(calculateIsOk({ content_mismatch: 2, boe_count: 5 })).toBe(false)
    })

    it('should return false when missing_in_db > 0', () => {
      expect(calculateIsOk({ missing_in_db: 3, boe_count: 5 })).toBe(false)
    })

    it('should return false when extra_in_db > 0 (without structure_articles)', () => {
      expect(calculateIsOk({ extra_in_db: 2, boe_count: 5 })).toBe(false)
    })

    it('should return true when extra_in_db equals structure_articles (structural extras ignored)', () => {
      expect(calculateIsOk({
        extra_in_db: 3,
        structure_articles: 3,
        boe_count: 10,
      })).toBe(true)
    })

    it('should return false when extra_in_db exceeds structure_articles', () => {
      expect(calculateIsOk({
        extra_in_db: 5,
        structure_articles: 2,
        boe_count: 10,
      })).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Verify Articles - Stats By Law Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getAllLawsWithVerification should return laws array', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => Promise.resolve([
            { id: 'law-1', shortName: 'CE', lastChecked: '2026-01-01', verificationStatus: 'ok', lastVerificationSummary: {} },
            { id: 'law-2', shortName: 'LPAC', lastChecked: null, verificationStatus: null, lastVerificationSummary: null },
          ]),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      laws: {
        id: 'id',
        shortName: 'short_name',
        lastChecked: 'last_checked',
        verificationStatus: 'verification_status',
        lastVerificationSummary: 'last_verification_summary',
      },
    }))

    const { getAllLawsWithVerification } = require('@/lib/api/verify-articles/queries')
    const result = await getAllLawsWithVerification()
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
    expect(result[0].shortName).toBe('CE')
    expect(result[1].lastChecked).toBeNull()
  })
})
