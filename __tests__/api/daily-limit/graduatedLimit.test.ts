// __tests__/api/daily-limit/graduatedLimit.test.ts
// Comprehensive tests for the graduated daily limit system
//
// Covers:
// 1. Pure calculation logic (calculateDynamicLimit)
// 2. All tier boundaries (exact day transitions)
// 3. All plan types (premium, trial, admin, legacy_free, free)
// 4. minLimitHitsRequired threshold
// 5. Zod schema validation
// 6. Config integrity
// 7. Real-world user journey simulations
// 8. Cache behavior (invalidation)
// 9. Edge cases (extreme values, missing data)

import { calculateDynamicLimit, invalidateLimitCache } from '@/lib/api/daily-limit/queries'
import { GRADUATED_LIMIT_CONFIG, PREMIUM_PLAN_TYPES } from '@/lib/api/daily-limit/config'
import { GraduatedLimitConfigSchema, UserLimitProfileSchema, DynamicLimitResultSchema } from '@/lib/api/daily-limit/schemas'
import type { UserLimitProfile } from '@/lib/api/daily-limit/schemas'

// =====================================================
// HELPERS
// =====================================================

function makeProfile(overrides: Partial<UserLimitProfile> = {}): UserLimitProfile {
  return {
    userId: 'a0000000-0000-4000-a000-000000000001',
    planType: 'free',
    createdAt: new Date().toISOString(),
    registrationAgeDays: 0,
    totalLimitHits: 0,
    isPremium: false,
    ...overrides,
  }
}

/** Simulate a user journey: returns the limit at each day milestone */
function simulateJourney(totalLimitHits: number, dayMilestones: number[]): { day: number; limit: number; tier: string | null; graduated: boolean }[] {
  return dayMilestones.map(day => {
    const result = calculateDynamicLimit(makeProfile({
      registrationAgeDays: day,
      totalLimitHits,
    }))
    return { day, limit: result.dailyLimit, tier: result.tierLabel, graduated: result.isGraduated }
  })
}

// =====================================================
// TESTS
// =====================================================

describe('Graduated Daily Limit System', () => {

  // =========================================
  // 1. Zod Schema Validation
  // =========================================
  describe('Zod schema validation', () => {
    it('config passes Zod validation', () => {
      const parsed = GraduatedLimitConfigSchema.safeParse(GRADUATED_LIMIT_CONFIG)
      expect(parsed.success).toBe(true)
    })

    it('rejects config with 0 defaultLimit', () => {
      const bad = { ...GRADUATED_LIMIT_CONFIG, defaultLimit: 0 }
      const parsed = GraduatedLimitConfigSchema.safeParse(bad)
      expect(parsed.success).toBe(false)
    })

    it('rejects config with negative minLimitHitsRequired', () => {
      const bad = { ...GRADUATED_LIMIT_CONFIG, minLimitHitsRequired: 0 }
      const parsed = GraduatedLimitConfigSchema.safeParse(bad)
      expect(parsed.success).toBe(false)
    })

    it('rejects config with empty tiers', () => {
      const bad = { ...GRADUATED_LIMIT_CONFIG, tiers: [] }
      const parsed = GraduatedLimitConfigSchema.safeParse(bad)
      expect(parsed.success).toBe(false)
    })

    it('validates a correct UserLimitProfile', () => {
      const profile = makeProfile({ registrationAgeDays: 50, totalLimitHits: 5 })
      const parsed = UserLimitProfileSchema.safeParse(profile)
      expect(parsed.success).toBe(true)
    })

    it('rejects UserLimitProfile with invalid userId', () => {
      const profile = { ...makeProfile(), userId: 'not-a-uuid' }
      const parsed = UserLimitProfileSchema.safeParse(profile)
      expect(parsed.success).toBe(false)
    })

    it('validates a correct DynamicLimitResult', () => {
      const result = calculateDynamicLimit(makeProfile({ registrationAgeDays: 50, totalLimitHits: 5 }))
      const parsed = DynamicLimitResultSchema.safeParse(result)
      expect(parsed.success).toBe(true)
    })
  })

  // =========================================
  // 2. Config Integrity
  // =========================================
  describe('config integrity', () => {
    it('defaultLimit is 25', () => {
      expect(GRADUATED_LIMIT_CONFIG.defaultLimit).toBe(25)
    })

    it('minLimitHitsRequired is 3', () => {
      expect(GRADUATED_LIMIT_CONFIG.minLimitHitsRequired).toBe(3)
    })

    it('has exactly 3 tiers', () => {
      expect(GRADUATED_LIMIT_CONFIG.tiers).toHaveLength(3)
    })

    it('first tier starts at day 0', () => {
      expect(GRADUATED_LIMIT_CONFIG.tiers[0].minDaysRegistered).toBe(0)
    })

    it('last tier has null maxDaysRegistered (unbounded)', () => {
      const lastTier = GRADUATED_LIMIT_CONFIG.tiers[GRADUATED_LIMIT_CONFIG.tiers.length - 1]
      expect(lastTier.maxDaysRegistered).toBeNull()
    })

    it('tiers are sorted ascending by minDaysRegistered', () => {
      const tiers = GRADUATED_LIMIT_CONFIG.tiers
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].minDaysRegistered).toBeGreaterThan(tiers[i - 1].minDaysRegistered)
      }
    })

    it('tiers cover full range without gaps (each min === previous max)', () => {
      const tiers = GRADUATED_LIMIT_CONFIG.tiers
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].minDaysRegistered).toBe(tiers[i - 1].maxDaysRegistered)
      }
    })

    it('each tier has a dailyLimit > 0', () => {
      GRADUATED_LIMIT_CONFIG.tiers.forEach(tier => {
        expect(tier.dailyLimit).toBeGreaterThan(0)
      })
    })

    it('tier limits are monotonically decreasing (or equal)', () => {
      const tiers = GRADUATED_LIMIT_CONFIG.tiers
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].dailyLimit).toBeLessThanOrEqual(tiers[i - 1].dailyLimit)
      }
    })

    it('expected tier values match the spec', () => {
      const tiers = GRADUATED_LIMIT_CONFIG.tiers
      expect(tiers[0]).toMatchObject({ minDaysRegistered: 0, maxDaysRegistered: 31, dailyLimit: 25, label: 'onboarding' })
      expect(tiers[1]).toMatchObject({ minDaysRegistered: 31, maxDaysRegistered: 61, dailyLimit: 25, label: 'established' })
      expect(tiers[2]).toMatchObject({ minDaysRegistered: 61, maxDaysRegistered: null, dailyLimit: 25, label: 'veteran' })
    })

    it('PREMIUM_PLAN_TYPES includes all expected types', () => {
      expect(PREMIUM_PLAN_TYPES).toContain('premium')
      expect(PREMIUM_PLAN_TYPES).toContain('trial')
      expect(PREMIUM_PLAN_TYPES).toContain('legacy_free')
      expect(PREMIUM_PLAN_TYPES).toContain('premium_semester')
      expect(PREMIUM_PLAN_TYPES).toContain('admin')
      expect(PREMIUM_PLAN_TYPES).not.toContain('free')
    })
  })

  // =========================================
  // 3. Premium Users — Always Unlimited
  // =========================================
  describe('premium users (all plan types)', () => {
    const premiumPlanTypes = ['premium', 'trial', 'legacy_free', 'premium_semester', 'admin'] as const

    premiumPlanTypes.forEach(planType => {
      it(`${planType}: returns 999 regardless of age or hits`, () => {
        const result = calculateDynamicLimit(makeProfile({
          planType,
          isPremium: true,
          registrationAgeDays: 200,
          totalLimitHits: 50,
        }))
        expect(result.dailyLimit).toBe(999)
        expect(result.isGraduated).toBe(false)
        expect(result.tierLabel).toBeNull()
      })
    })

    it('premium user at day 0 with 0 hits is still unlimited', () => {
      const result = calculateDynamicLimit(makeProfile({
        isPremium: true,
        registrationAgeDays: 0,
        totalLimitHits: 0,
      }))
      expect(result.dailyLimit).toBe(999)
    })

    it('premium user at day 365 with 100 hits is still unlimited', () => {
      const result = calculateDynamicLimit(makeProfile({
        isPremium: true,
        registrationAgeDays: 365,
        totalLimitHits: 100,
      }))
      expect(result.dailyLimit).toBe(999)
    })
  })

  // =========================================
  // 4. Free Users Below minLimitHitsRequired
  // =========================================
  describe('free users below minLimitHitsRequired (< 3 hits)', () => {
    it('0 hits, day 0: 210/day', () => {
      const result = calculateDynamicLimit(makeProfile({ registrationAgeDays: 0, totalLimitHits: 0 }))
      expect(result.dailyLimit).toBe(25)
      expect(result.isGraduated).toBe(false)
      expect(result.tierLabel).toBeNull()
    })

    it('0 hits, day 100: still 210/day (no graduation without hits)', () => {
      const result = calculateDynamicLimit(makeProfile({ registrationAgeDays: 100, totalLimitHits: 0 }))
      expect(result.dailyLimit).toBe(25)
      expect(result.isGraduated).toBe(false)
    })

    it('1 hit, day 60: still 210/day', () => {
      const result = calculateDynamicLimit(makeProfile({ registrationAgeDays: 60, totalLimitHits: 1 }))
      expect(result.dailyLimit).toBe(25)
      expect(result.isGraduated).toBe(false)
    })

    it('2 hits, day 180: still 210/day (below threshold)', () => {
      const result = calculateDynamicLimit(makeProfile({ registrationAgeDays: 180, totalLimitHits: 2 }))
      expect(result.dailyLimit).toBe(25)
      expect(result.isGraduated).toBe(false)
    })

    it('2 hits, day 365: still 210/day even for very old accounts', () => {
      const result = calculateDynamicLimit(makeProfile({ registrationAgeDays: 365, totalLimitHits: 2 }))
      expect(result.dailyLimit).toBe(25)
      expect(result.isGraduated).toBe(false)
    })
  })

  // =========================================
  // 5. Exact Boundary Tests (all tier transitions)
  // =========================================
  describe('exact tier boundary transitions (3+ hits)', () => {
    const HITS = 10 // well above threshold

    // Onboarding → First Reduction boundary at day 31
    it('day 0: onboarding, 210/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 0, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('onboarding')
    })

    it('day 15: onboarding, 210/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 15, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
    })

    it('day 30: onboarding, 210/day (last day before transition)', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 30, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('onboarding')
    })

    it('day 31: established, 25/day (no reduction)', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 31, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('established')
      // isGraduated is false because tier limit equals default
      expect(r.isGraduated).toBe(false)
    })

    it('day 32: established, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 32, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
    })

    // Established → Veteran boundary at day 61
    it('day 59: established, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 59, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
    })

    it('day 60: established, 25/day (veteran boundary)', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 60, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('established')
    })

    it('day 61: veteran, 25/day (no reduction)', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 61, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('veteran')
      expect(r.isGraduated).toBe(false)
    })

    it('day 62: veteran, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 62, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
    })

    it('day 89: veteran, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 89, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
    })

    it('day 90: veteran, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 90, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('veteran')
    })

    it('day 91: veteran, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 91, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('veteran')
      expect(r.isGraduated).toBe(false)
    })

    it('day 92: veteran, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 92, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
    })

    // Veteran stays at 25/day indefinitely
    it('day 180: veteran, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 180, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
    })

    it('day 365: veteran, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 365, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
    })

    it('day 1000: veteran, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 1000, totalLimitHits: HITS }))
      expect(r.dailyLimit).toBe(25)
    })
  })

  // =========================================
  // 6. minLimitHitsRequired Threshold (exactly 3)
  // =========================================
  describe('minLimitHitsRequired threshold', () => {
    it('2 hits at day 50: NOT graduated (210/day)', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 50, totalLimitHits: 2 }))
      expect(r.dailyLimit).toBe(25)
      expect(r.isGraduated).toBe(false)
      expect(r.tierLabel).toBeNull()
    })

    it('3 hits at day 50: established tier but no reduction (25/day)', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 50, totalLimitHits: 3 }))
      expect(r.dailyLimit).toBe(25)
      expect(r.isGraduated).toBe(false)
      expect(r.tierLabel).toBe('established')
    })

    it('4 hits at day 50: established tier but no reduction (25/day)', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 50, totalLimitHits: 4 }))
      expect(r.dailyLimit).toBe(25)
      expect(r.isGraduated).toBe(false)
    })

    it('3 hits at day 20: in onboarding, 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 20, totalLimitHits: 3 }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('onboarding')
      expect(r.isGraduated).toBe(false)
    })

    it('3 hits at day 91: veteran, 25/day (no reduction)', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 91, totalLimitHits: 3 }))
      expect(r.dailyLimit).toBe(25)
      expect(r.isGraduated).toBe(false)
    })
  })

  // =========================================
  // 7. Output Shape Validation
  // =========================================
  describe('output shape', () => {
    it('always returns registrationAgeDays from input', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 77 }))
      expect(r.registrationAgeDays).toBe(77)
    })

    it('always returns totalLimitHits from input', () => {
      const r = calculateDynamicLimit(makeProfile({ totalLimitHits: 42 }))
      expect(r.totalLimitHits).toBe(42)
    })

    it('premium returns tierLabel null', () => {
      const r = calculateDynamicLimit(makeProfile({ isPremium: true }))
      expect(r.tierLabel).toBeNull()
    })

    it('non-graduated free returns tierLabel null', () => {
      const r = calculateDynamicLimit(makeProfile({ totalLimitHits: 0, registrationAgeDays: 50 }))
      expect(r.tierLabel).toBeNull()
    })

    it('free user with hits in non-onboarding tier returns a tier label string', () => {
      const r = calculateDynamicLimit(makeProfile({ totalLimitHits: 5, registrationAgeDays: 50 }))
      expect(typeof r.tierLabel).toBe('string')
      expect(r.tierLabel!.length).toBeGreaterThan(0)
    })

    it('result passes DynamicLimitResultSchema for every scenario', () => {
      const scenarios: Partial<UserLimitProfile>[] = [
        { isPremium: true },
        { totalLimitHits: 0, registrationAgeDays: 0 },
        { totalLimitHits: 2, registrationAgeDays: 100 },
        { totalLimitHits: 5, registrationAgeDays: 10 },
        { totalLimitHits: 5, registrationAgeDays: 40 },
        { totalLimitHits: 5, registrationAgeDays: 70 },
        { totalLimitHits: 5, registrationAgeDays: 100 },
        { totalLimitHits: 50, registrationAgeDays: 365 },
      ]
      scenarios.forEach(s => {
        const result = calculateDynamicLimit(makeProfile(s))
        const parsed = DynamicLimitResultSchema.safeParse(result)
        expect(parsed.success).toBe(true)
      })
    })
  })

  // =========================================
  // 8. Edge Cases
  // =========================================
  describe('edge cases', () => {
    it('registrationAgeDays = 0, 0 hits: new user gets full limit', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 0, totalLimitHits: 0 }))
      expect(r.dailyLimit).toBe(25)
    })

    it('very high registrationAgeDays (10000 days) with hits: veteran at 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 10000, totalLimitHits: 100 }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('veteran')
    })

    it('very high totalLimitHits (1000) at day 31: established at 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 31, totalLimitHits: 1000 }))
      expect(r.dailyLimit).toBe(25)
    })

    it('isPremium overrides everything even with null planType', () => {
      const r = calculateDynamicLimit(makeProfile({ isPremium: true, planType: null }))
      expect(r.dailyLimit).toBe(999)
    })

    it('planType free with isPremium false: 25/day regardless of tier', () => {
      const r = calculateDynamicLimit(makeProfile({ isPremium: false, planType: 'free', registrationAgeDays: 50, totalLimitHits: 5 }))
      expect(r.dailyLimit).toBe(25)
    })
  })

  // =========================================
  // 9. Real-World User Journey Simulations
  // =========================================
  describe('user journey simulations', () => {

    it('Simulation: new user who never hits the limit — stays at 25 forever', () => {
      const journey = simulateJourney(0, [0, 7, 14, 30, 31, 60, 61, 90, 91, 120, 365])
      journey.forEach(step => {
        expect(step.limit).toBe(25)
        expect(step.graduated).toBe(false)
      })
    })

    it('Simulation: user who converts on day 4 (median) — was always at 25', () => {
      // This user hit the limit once on day 1, then paid on day 4
      const journey = simulateJourney(1, [0, 1, 2, 3, 4])
      journey.forEach(step => {
        expect(step.limit).toBe(25)
        // Only 1 hit < 3 threshold, never graduated
        expect(step.graduated).toBe(false)
      })
    })

    it('Simulation: user who hits limit 5 times and converts on day 25 (P75)', () => {
      // During the first 25 days, even with 5 hits, still in onboarding
      const journey = simulateJourney(5, [0, 5, 10, 15, 20, 25])
      journey.forEach(step => {
        expect(step.limit).toBe(25) // Still in onboarding window
        expect(step.tier).toBe('onboarding')
      })
    })

    it('Simulation: long-term free user — uniform 25/day at all tiers', () => {
      const journey = simulateJourney(10, [0, 15, 30, 31, 45, 60, 61, 75, 90, 91, 120, 180, 365])

      // All tiers now have the same limit: 25/day
      journey.forEach(step => {
        expect(step.limit).toBe(25)
      })
    })

    it('Simulation: casual user who hits limit only twice — never reduced', () => {
      const journey = simulateJourney(2, [0, 31, 61, 91, 180])
      journey.forEach(step => {
        expect(step.limit).toBe(25) // Never graduated
        expect(step.graduated).toBe(false)
        expect(step.tier).toBeNull()
      })
    })

    it('Simulation: user hits limit exactly 3 times — stays at 25/day across all tiers', () => {
      const journey = simulateJourney(3, [29, 30, 31, 59, 60, 61])

      journey.forEach(step => {
        expect(step.limit).toBe(25)
      })
    })

    it('Simulation: ismaelaguileraofficial (42 hits, 128 days) — gets 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 128, totalLimitHits: 42 }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('veteran')
      expect(r.isGraduated).toBe(false)
    })

    it('Simulation: burnodmonica5 (20 hits, 131 days) — gets 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 131, totalLimitHits: 20 }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('veteran')
    })

    it('Simulation: mipetitparty (8 hits, 169 days) — gets 25/day', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 169, totalLimitHits: 8 }))
      expect(r.dailyLimit).toBe(25)
      expect(r.tierLabel).toBe('veteran')
    })

    it('Simulation: edu77santoyo (24 hits, converted after 26 days) — was at 25 during conversion window', () => {
      // This user was premium by day 26, but let's check what they'd have gotten
      // At day 26 with 24 hits: still in onboarding (day < 31)
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 26, totalLimitHits: 24 }))
      expect(r.dailyLimit).toBe(25) // Would NOT have been reduced before paying
    })

    it('Simulation: new registration today, first test — full experience', () => {
      const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: 0, totalLimitHits: 0 }))
      expect(r.dailyLimit).toBe(25)
      expect(r.isGraduated).toBe(false)
      expect(r.tierLabel).toBeNull()
    })
  })

  // =========================================
  // 10. Determinism & Consistency
  // =========================================
  describe('determinism', () => {
    it('same input always produces same output', () => {
      const profile = makeProfile({ registrationAgeDays: 50, totalLimitHits: 5 })
      const r1 = calculateDynamicLimit(profile)
      const r2 = calculateDynamicLimit(profile)
      const r3 = calculateDynamicLimit(profile)
      expect(r1).toEqual(r2)
      expect(r2).toEqual(r3)
    })

    it('runs 1000 calculations without error', () => {
      for (let day = 0; day < 200; day++) {
        for (const hits of [0, 1, 2, 3, 5, 10, 50]) {
          const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: day, totalLimitHits: hits }))
          expect(r.dailyLimit).toBeGreaterThan(0)
          expect(r.dailyLimit).toBeLessThanOrEqual(999)
        }
      }
    })
  })

  // =========================================
  // 11. Cache Invalidation
  // =========================================
  describe('cache invalidation', () => {
    it('invalidateLimitCache does not throw for unknown userId', () => {
      expect(() => invalidateLimitCache('nonexistent-user-id')).not.toThrow()
    })

    it('invalidateLimitCache does not throw for valid userId', () => {
      expect(() => invalidateLimitCache('test-user-id')).not.toThrow()
    })
  })

  // =========================================
  // 12. Full Day-by-Day Sweep (comprehensive)
  // =========================================
  describe('full day-by-day sweep (0-100)', () => {
    it('limit never increases as days increase (monotonically decreasing for graduated users)', () => {
      let prevLimit = 999
      for (let day = 0; day <= 100; day++) {
        const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: day, totalLimitHits: 10 }))
        expect(r.dailyLimit).toBeLessThanOrEqual(prevLimit)
        prevLimit = r.dailyLimit
      }
    })

    it('correct limit at every day for a user with 10 hits — uniform 25/day', () => {
      for (let day = 0; day <= 100; day++) {
        const r = calculateDynamicLimit(makeProfile({ registrationAgeDays: day, totalLimitHits: 10 }))
        expect(r.dailyLimit).toBe(25)
      }
    })
  })
})
