/**
 * Tests para admin-sales-prediction: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  predictionRecordSchema,
  salesPredictionResponseSchema,
  salesPredictionErrorSchema,
} from '@/lib/api/admin-sales-prediction/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin Sales Prediction - Schemas', () => {
  describe('predictionRecordSchema', () => {
    it('should accept valid prediction record', () => {
      const result = predictionRecordSchema.safeParse({
        prediction_date: '2025-01-15',
        method_name: 'by_registrations',
        predicted_sales_per_month: 5.2,
        predicted_revenue_per_month: 104.0,
        prediction_inputs: { dailyRegistrations: 2.1 },
      })
      expect(result.success).toBe(true)
    })

    it('should accept all valid method names', () => {
      const methods = ['by_registrations', 'by_active_users', 'by_historic', 'combined'] as const
      for (const method of methods) {
        const result = predictionRecordSchema.safeParse({
          prediction_date: '2025-01-15',
          method_name: method,
          predicted_sales_per_month: 5,
          predicted_revenue_per_month: 100,
        })
        expect(result.success).toBe(true)
      }
    })

    it('should reject invalid method name', () => {
      const result = predictionRecordSchema.safeParse({
        prediction_date: '2025-01-15',
        method_name: 'invalid_method',
        predicted_sales_per_month: 5,
        predicted_revenue_per_month: 100,
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing required fields', () => {
      const result = predictionRecordSchema.safeParse({
        prediction_date: '2025-01-15',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('salesPredictionResponseSchema', () => {
    it('should accept valid response', () => {
      const result = salesPredictionResponseSchema.safeParse({
        conversion: {
          totalUsers: 500,
          uniquePayingUsers: 25,
          rate: 0.05,
        },
        mrr: {
          current: 200.50,
          activeSubscriptions: 15,
        },
        projectionMethods: {
          byRegistrations: { salesPerMonth: 3.5, revenuePerMonth: 70 },
          byActiveUsers: { salesPerMonth: 2.1, revenuePerMonth: 42 },
          byHistoric: { salesPerMonth: 4.0, revenuePerMonth: 80 },
          combined: { salesPerMonth: 3.5, revenuePerMonth: 70 },
        },
      })
      expect(result.success).toBe(true)
    })

    it('should accept zero values', () => {
      const result = salesPredictionResponseSchema.safeParse({
        conversion: { totalUsers: 0, uniquePayingUsers: 0, rate: 0 },
        mrr: { current: 0, activeSubscriptions: 0 },
        projectionMethods: {
          byRegistrations: { salesPerMonth: 0, revenuePerMonth: 0 },
          byActiveUsers: { salesPerMonth: 0, revenuePerMonth: 0 },
          byHistoric: { salesPerMonth: 0, revenuePerMonth: 0 },
          combined: { salesPerMonth: 0, revenuePerMonth: 0 },
        },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('salesPredictionErrorSchema', () => {
    it('should accept error response', () => {
      const result = salesPredictionErrorSchema.safeParse({
        error: 'Database connection failed',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing error', () => {
      const result = salesPredictionErrorSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin Sales Prediction - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getRegistrationData should return users', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => Promise.resolve([
            { id: 'user1', createdAt: '2025-01-01', planType: 'free' },
            { id: 'user2', createdAt: '2025-01-02', planType: 'premium' },
          ]),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      userProfiles: {},
    }))

    const { getRegistrationData } = require('@/lib/api/admin-sales-prediction/queries')
    const result = await getRegistrationData()
    expect(result).toHaveLength(2)
  })

  it('getPredictionAccuracy should return null on error', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => { throw new Error('View not found') },
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      predictionAccuracyByMethod: {},
      predictionHistory: {},
    }))

    const { getPredictionAccuracy } = require('@/lib/api/admin-sales-prediction/queries')
    const result = await getPredictionAccuracy()
    expect(result).toBeNull()
  })

  it('saveDailyPredictions should not throw on error', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: () => { throw new Error('DB error') },
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      predictionTracking: {},
    }))

    const { saveDailyPredictions } = require('@/lib/api/admin-sales-prediction/queries')
    // Should not throw
    await saveDailyPredictions([{
      prediction_date: '2025-01-15',
      method_name: 'combined',
      predicted_sales_per_month: 5,
      predicted_revenue_per_month: 100,
    }])
  })
})
