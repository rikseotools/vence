// lib/chat/domains/stats/schemas.ts
// Schemas Zod para el dominio de estadísticas

import { z } from 'zod'

// ============================================
// SCHEMAS DE ESTADÍSTICAS DE EXAMEN
// ============================================

export const articleCountSchema = z.object({
  law: z.string(),
  article: z.string(),
  count: z.number().int().nonnegative(),
  byPosition: z.record(z.string(), z.number().int().nonnegative()),
})

export type ArticleCount = z.infer<typeof articleCountSchema>

export const examStatsResultSchema = z.object({
  totalOfficialQuestions: z.number().int().nonnegative(),
  topArticles: z.array(articleCountSchema),
  lawFilter: z.string().nullable(),
  positionFilter: z.string().nullable(),
})

export type ExamStatsResult = z.infer<typeof examStatsResultSchema>

// ============================================
// SCHEMAS DE ESTADÍSTICAS DE USUARIO
// ============================================

export const articleStatsSchema = z.object({
  law: z.string(),
  article: z.string(),
  total: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(100),
})

export type ArticleStats = z.infer<typeof articleStatsSchema>

export const userStatsResultSchema = z.object({
  totalAnswers: z.number().int().nonnegative(),
  totalCorrect: z.number().int().nonnegative(),
  totalFailed: z.number().int().nonnegative(),
  overallAccuracy: z.number().min(0).max(100),
  mostFailed: z.array(articleStatsSchema),
  worstAccuracy: z.array(articleStatsSchema),
  lawFilter: z.string().nullable(),
})

export type UserStatsResult = z.infer<typeof userStatsResultSchema>

// ============================================
// SCHEMAS DE FILTROS TEMPORALES
// ============================================

export const temporalFilterSchema = z.object({
  fromDate: z.date().nullable(),
  label: z.string().nullable(),
})

export type TemporalFilter = z.infer<typeof temporalFilterSchema>

// ============================================
// SCHEMAS DE DETECCIÓN DE CONSULTAS
// ============================================

export const statsQueryTypeSchema = z.enum(['exam', 'user', 'none'])

export type StatsQueryType = z.infer<typeof statsQueryTypeSchema>

// ============================================
// VALIDADORES
// ============================================

export function validateExamStats(data: unknown): ExamStatsResult {
  return examStatsResultSchema.parse(data)
}

export function validateUserStats(data: unknown): UserStatsResult {
  return userStatsResultSchema.parse(data)
}
