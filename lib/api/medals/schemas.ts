// lib/api/medals/schemas.ts - Schemas de validacion para medallas de ranking
import { z } from 'zod/v3'

// ============================================
// DEFINICIONES DE MEDALLAS
// ============================================

export interface MedalDefinition {
  id: string
  title: string
  description: string
  category: string
  emailTemplate: string
}

export const RANKING_MEDALS: Record<string, MedalDefinition> = {
  FIRST_PLACE_TODAY: {
    id: 'first_place_today',
    title: 'Lider del Dia',
    description: 'Primer lugar en el ranking diario',
    category: 'Ranking Diario',
    emailTemplate: 'daily_champion',
  },
  FIRST_PLACE_WEEK: {
    id: 'first_place_week',
    title: 'Lider Semanal',
    description: 'Primer lugar en el ranking semanal',
    category: 'Ranking Semanal',
    emailTemplate: 'weekly_champion',
  },
  FIRST_PLACE_MONTH: {
    id: 'first_place_month',
    title: 'Lider Mensual',
    description: 'Primer lugar en el ranking mensual',
    category: 'Ranking Mensual',
    emailTemplate: 'monthly_champion',
  },
  TOP_3_TODAY: {
    id: 'top_3_today',
    title: 'Podio Diario',
    description: 'Top 3 en el ranking del dia',
    category: 'Ranking Diario',
    emailTemplate: 'daily_podium',
  },
  TOP_3_WEEK: {
    id: 'top_3_week',
    title: 'Podio Semanal',
    description: 'Top 3 en el ranking semanal',
    category: 'Ranking Semanal',
    emailTemplate: 'weekly_podium',
  },
  TOP_3_MONTH: {
    id: 'top_3_month',
    title: 'Podio Mensual',
    description: 'Top 3 en el ranking mensual',
    category: 'Ranking Mensual',
    emailTemplate: 'monthly_podium',
  },
  HIGH_ACCURACY: {
    id: 'high_accuracy',
    title: 'Precision Extrema',
    description: 'Mas del 90% de aciertos en el ranking semanal',
    category: 'Rendimiento',
    emailTemplate: 'high_accuracy',
  },
  VOLUME_LEADER: {
    id: 'volume_leader',
    title: 'Maquina de Preguntas',
    description: 'Mas de 100 preguntas en una semana',
    category: 'Volumen',
    emailTemplate: 'volume_leader',
  },
}

// ============================================
// SCHEMAS
// ============================================

export const userMedalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  emailTemplate: z.string(),
  unlocked: z.boolean(),
  progress: z.string(),
  unlockedAt: z.string(),
  rank: z.number().int(),
  period: z.string(),
  stats: z.object({
    userId: z.string(),
    totalQuestions: z.number().int(),
    correctAnswers: z.number().int(),
    accuracy: z.number(),
  }).nullable().optional(),
})

export type UserMedal = z.infer<typeof userMedalSchema>

export const checkMedalsRequestSchema = z.object({
  userId: z.string().uuid(),
})

export type CheckMedalsRequest = z.infer<typeof checkMedalsRequestSchema>

export const getMedalsRequestSchema = z.object({
  userId: z.string().uuid(),
})

export type GetMedalsRequest = z.infer<typeof getMedalsRequestSchema>

export const getMedalsResponseSchema = z.object({
  success: z.boolean(),
  medals: z.array(userMedalSchema).optional(),
  error: z.string().optional(),
})

export type GetMedalsResponse = z.infer<typeof getMedalsResponseSchema>

export const checkMedalsResponseSchema = z.object({
  success: z.boolean(),
  newMedals: z.array(userMedalSchema).optional(),
  error: z.string().optional(),
})

export type CheckMedalsResponse = z.infer<typeof checkMedalsResponseSchema>

// ============================================
// VALIDATORS
// ============================================

export function safeParseGetMedalsRequest(data: unknown) {
  return getMedalsRequestSchema.safeParse(data)
}

export function safeParseCheckMedalsRequest(data: unknown) {
  return checkMedalsRequestSchema.safeParse(data)
}
