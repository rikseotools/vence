// lib/api/question-favorites/schemas.ts — contratos de las preguntas favoritas (T-261).
//
// Petición de Laura Zurdo (feedback 46372450): marcar preguntas con un corazón y
// repasar solo las guardadas. Ver `supabase/migrations/20260729_user_question_favorites.sql`
// para el porqué del modelo de datos.
import { z } from 'zod/v3'

/** Límite duro de favoritas servidas en un test de repaso. */
export const MAX_FAVORITAS_POR_TEST = 100

/** Marcar / desmarcar una pregunta. El userId sale SIEMPRE del token, nunca del body. */
export const toggleFavoriteRequestSchema = z.object({
  questionId: z.string().uuid('questionId debe ser un UUID'),
  /**
   * Contexto de dónde la está guardando. Opcional a propósito: guardar desde un test
   * por leyes no tiene tema, y desde el propio repaso de favoritas no tiene ninguno
   * de los dos. Se anota al marcar porque DESPUÉS no se puede reconstruir: la misma
   * pregunta aparece en temas distintos según la oposición (modelo nuclear).
   */
  positionType: z.string().min(1).max(120).optional(),
  topicNumber: z.number().int().positive().optional(),
})
export type ToggleFavoriteRequest = z.infer<typeof toggleFavoriteRequestSchema>

export const toggleFavoriteResponseSchema = z.object({
  success: z.boolean(),
  isFavorite: z.boolean(),
  /** Total de favoritas del usuario tras la operación (para pintar el contador sin otra query). */
  total: z.number().int().nonnegative(),
})
export type ToggleFavoriteResponse = z.infer<typeof toggleFavoriteResponseSchema>

/**
 * Test de repaso de favoritas. Mismo contrato que el repaso de fallos
 * (`createFailedQuestionsTestSchema`) para que la página cliente sea gemela:
 * número de preguntas y orden.
 */
export const favoriteQuestionsTestRequestSchema = z.object({
  numQuestions: z.number().int().min(1).max(MAX_FAVORITAS_POR_TEST).default(20),
  /** `recent` = las últimas guardadas primero; `random` = mezcladas para variar el repaso. */
  orderBy: z.enum(['recent', 'random']).default('recent'),
})
export type FavoriteQuestionsTestRequest = z.infer<typeof favoriteQuestionsTestRequestSchema>

export function safeParseToggleFavorite(data: unknown) {
  return toggleFavoriteRequestSchema.safeParse(data)
}

export function safeParseFavoriteQuestionsTest(data: unknown) {
  return favoriteQuestionsTestRequestSchema.safeParse(data)
}
