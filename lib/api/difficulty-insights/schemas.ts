// lib/api/difficulty-insights/schemas.ts
import { z } from 'zod'

// Request
export const getDifficultyInsightsRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
})

export type GetDifficultyInsightsRequest = z.infer<typeof getDifficultyInsightsRequestSchema>

// Métricas globales del usuario
export const difficultyMetricsSchema = z.object({
  totalQuestionsAttempted: z.number(),
  questionsMastered: z.number(),
  questionsStruggling: z.number(),
  avgPersonalDifficulty: z.number(),
  accuracyTrend: z.enum(['improving', 'declining', 'stable']),
})

export type DifficultyMetrics = z.infer<typeof difficultyMetricsSchema>

// Pregunta con rendimiento
export const questionResultSchema = z.object({
  questionId: z.string().uuid(),
  questionText: z.string(),
  totalAttempts: z.number(),
  successRate: z.number(), // 0-1
  personalDifficulty: z.number(),
  trend: z.string().optional(),
  // Datos para hacer la tarjeta accionable
  lawSlug: z.string().nullable().optional(),
  lawName: z.string().nullable().optional(),
  articleNumber: z.string().nullable().optional(),
})

export type QuestionResult = z.infer<typeof questionResultSchema>

// Tendencias de progreso
export const progressTrendsSchema = z.object({
  improving: z.number(),
  declining: z.number(),
  stable: z.number(),
  total: z.number(),
})

export type ProgressTrends = z.infer<typeof progressTrendsSchema>

// Recomendación personalizada
export const recommendationSchema = z.object({
  priority: z.enum(['high', 'medium', 'low']),
  title: z.string(),
  description: z.string(),
  actionType: z.string().optional(),
})

export type Recommendation = z.infer<typeof recommendationSchema>

// Desglose por dificultad personal
export const personalBreakdownSchema = z.object({
  easy: z.number(),
  medium: z.number(),
  hard: z.number(),
  extreme: z.number(),
  total: z.number(),
})

export type PersonalBreakdown = z.infer<typeof personalBreakdownSchema>

// Response completo
export const getDifficultyInsightsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    metrics: difficultyMetricsSchema,
    personalBreakdown: personalBreakdownSchema,
    strugglingQuestions: z.array(questionResultSchema),
    masteredQuestions: z.array(questionResultSchema),
    progressTrends: progressTrendsSchema,
    recommendations: z.array(recommendationSchema),
  }).optional(),
  error: z.string().optional(),
})

export type GetDifficultyInsightsResponse = z.infer<typeof getDifficultyInsightsResponseSchema>
