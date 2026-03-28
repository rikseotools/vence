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
  topicTitle: z.string().nullable().optional(),
  topicPositionType: z.string().nullable().optional(),
  lawName: z.string().nullable().optional(),
})

// Rendimiento por tema
export const themePerformanceSchema = z.object({
  temaNumber: z.number(),
  title: z.string().nullable().optional(),
  topicPositionType: z.string().nullable().optional(),
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
  temaNumber: z.number().nullable(), // Para filtrar por tema
  totalQuestions: z.number(),
  correctAnswers: z.number(),
  accuracy: z.number(),
})

// Sesiones de usuario (para analytics de sesión)
export const userSessionSchema = z.object({
  totalDurationMinutes: z.number().nullable(),
  engagementScore: z.number().nullable(),
  sessionStart: z.string().nullable(),
  testsCompleted: z.number().nullable(),
  questionsAnswered: z.number().nullable(),
})

// Información de la oposición del usuario
export const userOposicionSchema = z.object({
  // Datos del usuario
  userName: z.string().nullable(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_say']).nullable().optional(),
  // Datos de la oposición
  slug: z.string().nullable(),
  nombre: z.string().nullable(),
  tipoAcceso: z.string().nullable(), // 'libre', 'promocion_interna', etc.
  examDate: z.string().nullable(), // ISO date (YYYY-MM-DD)
  examDateApproximate: z.boolean().nullable(), // true = fecha estimada, false/null = fecha confirmada
  inscriptionDeadline: z.string().nullable(),
  plazas: z.number().nullable(), // Total de plazas
  plazasLibres: z.number().nullable(), // Plazas acceso libre
  plazasPromocionInterna: z.number().nullable(), // Plazas promoción interna
  temasCount: z.number().nullable(),
  bloquesCount: z.number().nullable(),
  // Datos del BOE
  boePublicationDate: z.string().nullable(),
  boeReference: z.string().nullable(),
  programaUrl: z.string().nullable().optional(),
  // Datos para predicciones
  daysSinceJoin: z.number().nullable(), // Días desde registro (para calcular ritmo de estudio)
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
    allArticles: z.array(articlePerformanceSchema).optional(),
    userOposicion: userOposicionSchema.optional(),
    userSessions: z.array(userSessionSchema).optional(),
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
export type UserSession = z.infer<typeof userSessionSchema>

// ============================================
// VALIDATORS
// ============================================

export function validateGetUserStatsRequest(data: unknown): GetUserStatsRequest {
  return getUserStatsRequestSchema.parse(data)
}

export function safeParseGetUserStatsRequest(data: unknown) {
  return getUserStatsRequestSchema.safeParse(data)
}
