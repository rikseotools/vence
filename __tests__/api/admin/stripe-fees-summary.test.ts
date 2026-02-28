/**
 * Tests para admin-stripe-fees-summary: schema only (query inline)
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import { z } from 'zod/v3'

// Inline schemas since this route has no lib module
const stripeFeesSummaryResponseSchema = z.object({
  success: z.boolean(),
  summary: z.object({
    charges: z.object({
      count: z.number().int().min(0),
      totalGross: z.number(),
      totalFees: z.number(),
      totalNet: z.number(),
    }),
    payouts: z.object({
      count: z.number().int().min(0),
      totalAmount: z.number(),
      totalFees: z.number(),
    }),
    platformFees: z.object({
      count: z.number().int().min(0),
      totalFees: z.number(),
    }),
    totals: z.object({
      grossRevenue: z.number(),
      chargeFees: z.number(),
      payoutFees: z.number(),
      billingFees: z.number(),
      totalAllFees: z.number(),
      trueNet: z.number(),
      manuelAmount: z.number(),
      armandoAmount: z.number(),
    }),
    pending: z.object({
      payments: z.number().int().min(0),
      gross: z.number(),
      chargeFees: z.number(),
      estimatedPayoutFees: z.number(),
      trueNet: z.number(),
      manuelAmount: z.number(),
      armandoAmount: z.number(),
    }),
  }).optional(),
  currentBalance: z.object({
    available: z.number(),
    pending: z.number(),
  }).optional(),
  timestamp: z.string().optional(),
  error: z.string().optional(),
})

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Stripe Fees Summary - Schemas', () => {
  describe('stripeFeesSummaryResponseSchema', () => {
    it('should accept valid response with all fields', () => {
      const result = stripeFeesSummaryResponseSchema.safeParse({
        success: true,
        summary: {
          charges: { count: 5, totalGross: 10000, totalFees: 500, totalNet: 9500 },
          payouts: { count: 2, totalAmount: 9000, totalFees: 50 },
          platformFees: { count: 1, totalFees: 100 },
          totals: {
            grossRevenue: 10000,
            chargeFees: 500,
            payoutFees: 50,
            billingFees: 100,
            totalAllFees: 650,
            trueNet: 9350,
            manuelAmount: 8415,
            armandoAmount: 935,
          },
          pending: {
            payments: 1,
            gross: 2000,
            chargeFees: 100,
            estimatedPayoutFees: 19,
            trueNet: 1881,
            manuelAmount: 1693,
            armandoAmount: 188,
          },
        },
        currentBalance: { available: 5000, pending: 2000 },
        timestamp: '2025-01-15T10:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('should accept error response', () => {
      const result = stripeFeesSummaryResponseSchema.safeParse({
        success: false,
        error: 'Stripe API error',
      })
      expect(result.success).toBe(true)
    })

    it('should accept zero values', () => {
      const result = stripeFeesSummaryResponseSchema.safeParse({
        success: true,
        summary: {
          charges: { count: 0, totalGross: 0, totalFees: 0, totalNet: 0 },
          payouts: { count: 0, totalAmount: 0, totalFees: 0 },
          platformFees: { count: 0, totalFees: 0 },
          totals: {
            grossRevenue: 0,
            chargeFees: 0,
            payoutFees: 0,
            billingFees: 0,
            totalAllFees: 0,
            trueNet: 0,
            manuelAmount: 0,
            armandoAmount: 0,
          },
          pending: {
            payments: 0,
            gross: 0,
            chargeFees: 0,
            estimatedPayoutFees: 0,
            trueNet: 0,
            manuelAmount: 0,
            armandoAmount: 0,
          },
        },
        currentBalance: { available: 0, pending: 0 },
        timestamp: '2025-01-15T10:00:00Z',
      })
      expect(result.success).toBe(true)
    })

    it('should validate 90/10 split consistency', () => {
      const grossRevenue = 10000
      const totalFees = 650
      const trueNet = grossRevenue - totalFees
      const manuelAmount = Math.round(trueNet * 0.9)
      const armandoAmount = trueNet - manuelAmount

      expect(manuelAmount + armandoAmount).toBe(trueNet)
      expect(manuelAmount).toBe(8415)
      expect(armandoAmount).toBe(935)
    })
  })
})
