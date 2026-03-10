// lib/api/admin-charts/schemas.ts - Schemas Zod para charts de admin
import { z } from 'zod'

// ============================================
// REQUEST
// ============================================

export const chartRequestSchema = z.object({
  days: z.number().int().min(1).max(90).default(14),
})

export type ChartRequest = z.infer<typeof chartRequestSchema>

// ============================================
// RESPONSE - Activity Chart
// ============================================

export const activityDaySchema = z.object({
  dia: z.string(),
  weekday: z.string(),
  actual: z.number(),
  anterior: z.number(),
})

export const activityChartResponseSchema = z.object({
  data: z.array(activityDaySchema),
})

export type ActivityChartResponse = z.infer<typeof activityChartResponseSchema>

// ============================================
// RESPONSE - Registrations Chart
// ============================================

export const registrationDaySchema = z.object({
  dia: z.string(),
  total: z.number(),
  organic: z.number(),
  google: z.number(),
  meta: z.number(),
  other: z.number(),
  isToday: z.boolean(),
})

export const registrationsChartResponseSchema = z.object({
  data: z.array(registrationDaySchema),
})

export type RegistrationsChartResponse = z.infer<typeof registrationsChartResponseSchema>
