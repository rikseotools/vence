/**
 * Tests para admin-engagement-stats: schemas
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  engagementStatsResponseSchema,
} from '@/lib/api/admin-engagement-stats/schemas'

// Helper: minimal valid response matching all required fields
function makeValidResponse(overrides: Record<string, any> = {}) {
  return {
    totalUsers: 200,
    averageDAU: 15,
    MAU: 50,
    dauMauRatio: 30,
    registeredActiveRatio: 25,
    dauMauHistory: [
      { date: '2026-02-15', dau: 10, mau: 50, ratio: 20, formattedDate: '15 feb', weekday: 'lun' },
    ],
    activationHistory: [
      { date: '2026-02-15', formattedDate: '15 feb', weekday: 'lun', total: 5, organic: 3, meta: 1, google: 1 },
    ],
    activationSummary: {
      totalOrganic: 100, totalMeta: 50, totalGoogle: 50,
      activatedOrganic: 30, activatedMeta: 10, activatedGoogle: 10,
      totalActivated: 50,
    },
    retentionAnalysis: [
      { week: 'Semana 1', registered: 20, day1Retention: 50, day7Retention: 30, day30Retention: 10 },
    ],
    engagementDepth: {
      testsPerActiveUser: 5.2,
      avgDaysActivePerMonth: 3.1,
      avgLongestStreak: 2.5,
      userEngagementLevels: { casual: 20, regular: 15, power: 5 },
      distributionDaysActive: { '1': 10, '3': 5 },
    },
    engagementDepthHistory: [
      { month: 'feb 2026', testsPerUser: 5, avgDaysActive: 3, activeUsers: 40 },
    ],
    habitFormation: {
      powerUsers: 5,
      powerUsersPercentage: 10,
      weeklyActiveUsers: 20,
      weeklyActivePercentage: 40,
      habitDistribution: { occasional: 25, regular: 15, habitual: 10 },
      avgSessionsPerWeek: 3.5,
    },
    habitFormationHistory: [
      { month: 'feb 2026', powerUsersPercent: 10, weeklyActivePercent: 40, activeUsers: 50 },
    ],
    retentionRateHistory: [
      { period: 'P1', periodLabel: 'feb 1', registered: 30, day1Retention: 40, day7Retention: 25, day30Retention: 10 },
    ],
    cohortAnalysis: [
      { week: 'Semana 1', registered: 25, active: 10, retentionRate: 40 },
    ],
    ...overrides,
  }
}

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Engagement Stats - Schemas', () => {
  describe('engagementStatsResponseSchema', () => {
    it('should accept valid full response', () => {
      const result = engagementStatsResponseSchema.safeParse(makeValidResponse())
      expect(result.success).toBe(true)
    })

    it('should accept zero metrics', () => {
      const result = engagementStatsResponseSchema.safeParse(makeValidResponse({
        totalUsers: 0,
        averageDAU: 0,
        MAU: 0,
        dauMauRatio: 0,
        registeredActiveRatio: 0,
      }))
      expect(result.success).toBe(true)
    })

    it('should reject negative totalUsers', () => {
      const result = engagementStatsResponseSchema.safeParse(makeValidResponse({
        totalUsers: -1,
      }))
      expect(result.success).toBe(false)
    })

    it('should reject missing core fields', () => {
      const result = engagementStatsResponseSchema.safeParse({
        totalUsers: 100,
      })
      expect(result.success).toBe(false)
    })

    it('should accept empty arrays', () => {
      const result = engagementStatsResponseSchema.safeParse(makeValidResponse({
        dauMauHistory: [],
        activationHistory: [],
        retentionAnalysis: [],
        engagementDepthHistory: [],
        habitFormationHistory: [],
        retentionRateHistory: [],
        cohortAnalysis: [],
      }))
      expect(result.success).toBe(true)
    })

    it('should accept weekLabel as optional in retentionAnalysis', () => {
      const result = engagementStatsResponseSchema.safeParse(makeValidResponse({
        retentionAnalysis: [
          { week: 'Semana 1', registered: 10, day1Retention: 50, day7Retention: 30, day30Retention: 10 },
        ],
      }))
      expect(result.success).toBe(true)
    })

    it('should accept multiple dauMauHistory entries', () => {
      const entries = Array.from({ length: 14 }, (_, i) => ({
        date: `2026-02-${String(i + 1).padStart(2, '0')}`,
        dau: 10 + i,
        mau: 50,
        ratio: Math.round(((10 + i) / 50) * 100),
        formattedDate: `${i + 1} feb`,
        weekday: 'lun',
      }))
      const result = engagementStatsResponseSchema.safeParse(makeValidResponse({
        dauMauHistory: entries,
      }))
      expect(result.success).toBe(true)
    })
  })
})
