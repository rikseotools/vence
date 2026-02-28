// lib/api/admin-sales-prediction/schemas.ts - Schemas para predicciones de ventas
import { z } from 'zod/v3'

// ============================================
// PREDICTION TRACKING INPUT
// ============================================

export const predictionRecordSchema = z.object({
  prediction_date: z.string(),
  method_name: z.enum(['by_registrations', 'by_active_users', 'by_historic', 'combined']),
  predicted_sales_per_month: z.number(),
  predicted_revenue_per_month: z.number(),
  prediction_inputs: z.record(z.unknown()).optional(),
})

export type PredictionRecord = z.infer<typeof predictionRecordSchema>

// ============================================
// RESPONSE (simplified — actual response is large and deeply nested)
// ============================================

export const salesPredictionResponseSchema = z.object({
  conversion: z.object({
    totalUsers: z.number().int().min(0),
    uniquePayingUsers: z.number().int().min(0),
    rate: z.number().min(0),
  }),
  mrr: z.object({
    current: z.number().min(0),
    activeSubscriptions: z.number().int().min(0),
  }),
  projectionMethods: z.object({
    byRegistrations: z.object({
      salesPerMonth: z.number(),
      revenuePerMonth: z.number(),
    }),
    byActiveUsers: z.object({
      salesPerMonth: z.number(),
      revenuePerMonth: z.number(),
    }),
    byHistoric: z.object({
      salesPerMonth: z.number(),
      revenuePerMonth: z.number(),
    }),
    combined: z.object({
      salesPerMonth: z.number(),
      revenuePerMonth: z.number(),
    }),
  }),
})

export type SalesPredictionResponse = z.infer<typeof salesPredictionResponseSchema>

// ============================================
// ERROR
// ============================================

export const salesPredictionErrorSchema = z.object({
  error: z.string(),
})

export type SalesPredictionError = z.infer<typeof salesPredictionErrorSchema>
