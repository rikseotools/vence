// lib/api/admin-reset-user-stats/schemas.ts
import { z } from 'zod/v3'

// ============================================
// REQUEST: RESET USER STATS
// ============================================
//
// `reason` es OBLIGATORIO y no por burocracia: este endpoint borra métricas de
// cualquier usuario con solo un userId. El motivo queda en user_stats_resets
// junto al admin que lo pidió — es el audit trail que separa una herramienta de
// admin de un botón de destruir sin testigos. La función SQL lo exige también.

export const resetUserStatsRequestSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().min(10, 'reason debe explicar el motivo (mín. 10 caracteres)'),
  // Analítica interna de journey (user_interactions/user_sessions). Fuera por
  // defecto: no es lo que el usuario ve en su perfil, no ensucia sus métricas y
  // es lo que permite diagnosticarle en soporte.
  includeAnalytics: z.boolean().optional().default(false),
})

export type ResetUserStatsRequest = z.infer<typeof resetUserStatsRequestSchema>

// ============================================
// RESPONSE
// ============================================

export const resetUserStatsResponseSchema = z.object({
  success: z.boolean(),
  userId: z.string(),
  resetId: z.string().nullable(),
  /** {tabla: filas_borradas} — vacío si el usuario no tenía métricas. */
  deletedCounts: z.record(z.string(), z.number()),
  totalRowsDeleted: z.number(),
})

export type ResetUserStatsResponse = z.infer<typeof resetUserStatsResponseSchema>

export const resetUserStatsErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})

export type ResetUserStatsError = z.infer<typeof resetUserStatsErrorSchema>
