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

// Stats con ventana EXPLÍCITA (antes "promedio"/"máximo" no decían de qué periodo eran).
export const activityStatsSchema = z.object({
  avg7d: z.number(),        // promedio diario de los últimos 7 días (ritmo reciente)
  max90d: z.number(),       // pico diario en 90 días (récord real, no de la quincena)
  delta30dPct: z.number().nullable(), // % del avg7d actual vs el avg7d de hace ~30 días
  delta90dPct: z.number().nullable(), // % del avg7d actual vs el avg7d de hace ~90 días
})

export type ActivityStats = z.infer<typeof activityStatsSchema>

export const activityChartResponseSchema = z.object({
  data: z.array(activityDaySchema),
  stats: activityStatsSchema.optional(),
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
