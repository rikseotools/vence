// lib/api/user-stats/schemas.ts - Schemas Zod para User Stats v2
import { z } from 'zod'

export const getUserStatsRequestSchema = z.object({
  userId: z.string().uuid(),
})

export const userPublicStatsSchema = z.object({
  // Core (user_stats_summary, <1ms)
  totalQuestions: z.number(),
  globalAccuracy: z.number(),
  currentStreak: z.number(),
  questionsThisWeek: z.number(),
  // Desglose añadido 15/4/2026 con la feature "Dejar en blanco" (sugerencia
  // Tinokero): permite mostrar correctas/falladas/en blanco separadas.
  //   correctAnswers + incorrectAnswers + blankAnswers === totalQuestions
  //   globalAccuracy = (correctAnswers / totalQuestions) * 100 — las blancas
  //   SÍ cuentan en el denominador (evita exploit "100% con 1 acertada y
  //   todas las demás en blanco").
  correctAnswers: z.number(),
  incorrectAnswers: z.number(),
  blankAnswers: z.number(),

  // Perfil (user_profiles, PK lookup)
  targetOposicion: z.string().nullable(),
  userCreatedAt: z.string().nullable(),

  // Racha (user_streaks, PK lookup)
  longestStreak: z.number(),

  // Tests (agregados con índice idx_tests_user_completed)
  totalTestsCompleted: z.number(),

  // Hoy (zona Madrid, agregados con índice user+created_at)
  todayTests: z.number(),
  todayQuestions: z.number(),
  todayCorrect: z.number(),
})

export type UserPublicStats = z.infer<typeof userPublicStatsSchema>
