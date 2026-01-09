// lib/api/stats/schemas.ts - Schemas de validación para estadísticas de usuario
import { z } from 'zod'

// ============================================
// REQUEST SCHEMAS
// ============================================

export const getUserStatsRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
})

export type GetUserStatsRequest = z.infer<typeof getUserStatsRequestSchema>

// ============================================
// RESPONSE SCHEMAS
// ============================================

// Estadísticas principales
export const mainStatsSchema = z.object({
  totalTests: z.number(),
  totalQuestions: z.number(),
  correctAnswers: z.number(),
  accuracy: z.number(), // 0-100
  totalStudyTimeSeconds: z.number(),
  averageTimePerQuestion: z.number(), // segundos
  bestScore: z.number(), // 0-100
  currentStreak: z.number(),
  longestStreak: z.number(),
})

// Progreso semanal
export const weeklyProgressSchema = z.object({
  day: z.string(), // 'Lun', 'Mar', etc.
  date: z.string(), // ISO date
  questions: z.number(),
  correct: z.number(),
  accuracy: z.number(),
  studyMinutes: z.number(),
})

// Tests recientes
export const recentTestSchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  temaNumber: z.number().nullable(),
  score: z.number(),
  totalQuestions: z.number(),
  accuracy: z.number(),
  completedAt: z.string(),
  timeSeconds: z.number(),
})

// Rendimiento por tema
export const themePerformanceSchema = z.object({
  temaNumber: z.number(),
  title: z.string().nullable().optional(), // Título del tema desde la BD
  totalQuestions: z.number(),
  correctAnswers: z.number(),
  accuracy: z.number(),
  averageTime: z.number(),
  lastPracticed: z.string().nullable(),
})

// Rendimiento por dificultad
export const difficultyBreakdownSchema = z.object({
  difficulty: z.string(),
  totalQuestions: z.number(),
  correctAnswers: z.number(),
  accuracy: z.number(),
  averageTime: z.number(),
})

// Patrones de tiempo
export const timePatternsSchema = z.object({
  hourlyDistribution: z.array(z.object({
    hour: z.number(),
    questions: z.number(),
    accuracy: z.number(),
  })),
  bestHours: z.array(z.number()),
  worstHours: z.array(z.number()),
  averageSessionMinutes: z.number(),
})

// Análisis de artículos
export const articlePerformanceSchema = z.object({
  articleId: z.string().uuid().nullable(),
  articleNumber: z.string().nullable(),
  lawName: z.string().nullable(),
  totalQuestions: z.number(),
  correctAnswers: z.number(),
  accuracy: z.number(),
})

// Información de la oposición del usuario
export const userOposicionSchema = z.object({
  // Datos del usuario
  userName: z.string().nullable(),
  // Datos de la oposición
  slug: z.string().nullable(),
  nombre: z.string().nullable(),
  examDate: z.string().nullable(), // ISO date (YYYY-MM-DD)
  inscriptionDeadline: z.string().nullable(),
  plazas: z.number().nullable(),
  temasCount: z.number().nullable(),
  // Datos del BOE
  boePublicationDate: z.string().nullable(),
  boeReference: z.string().nullable(),
})

// Response completo
export const getUserStatsResponseSchema = z.object({
  success: z.boolean(),
  stats: z.object({
    main: mainStatsSchema,
    weeklyProgress: z.array(weeklyProgressSchema),
    recentTests: z.array(recentTestSchema),
    themePerformance: z.array(themePerformanceSchema),
    difficultyBreakdown: z.array(difficultyBreakdownSchema),
    timePatterns: timePatternsSchema,
    weakArticles: z.array(articlePerformanceSchema),
    strongArticles: z.array(articlePerformanceSchema),
    userOposicion: userOposicionSchema.optional(),
  }).optional(),
  error: z.string().optional(),
  cached: z.boolean().optional(),
  generatedAt: z.string().optional(),
})

export type GetUserStatsResponse = z.infer<typeof getUserStatsResponseSchema>
export type MainStats = z.infer<typeof mainStatsSchema>
export type WeeklyProgress = z.infer<typeof weeklyProgressSchema>
export type RecentTest = z.infer<typeof recentTestSchema>
export type ThemePerformance = z.infer<typeof themePerformanceSchema>
export type DifficultyBreakdown = z.infer<typeof difficultyBreakdownSchema>
export type TimePatterns = z.infer<typeof timePatternsSchema>
export type ArticlePerformance = z.infer<typeof articlePerformanceSchema>
export type UserOposicion = z.infer<typeof userOposicionSchema>

// ============================================
// VALIDATORS
// ============================================

export function validateGetUserStatsRequest(data: unknown): GetUserStatsRequest {
  return getUserStatsRequestSchema.parse(data)
}

export function safeParseGetUserStatsRequest(data: unknown) {
  return getUserStatsRequestSchema.safeParse(data)
}
