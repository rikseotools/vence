// lib/api/shared/difficulty.ts
// Valores válidos para test_questions.difficulty (CHECK constraint en BD)
// Fuente de verdad: db/schema.ts línea 610
import { z } from 'zod/v3'

export const VALID_DIFFICULTIES = ['easy', 'medium', 'hard', 'extreme'] as const
export type ValidDifficulty = (typeof VALID_DIFFICULTIES)[number]

/** Schema Zod para difficulty en requests de INPUT (escritura a BD).
 *  Acepta los 4 valores válidos o null. Rechaza cualquier otro string. */
export const difficultyInputSchema = z.enum(VALID_DIFFICULTIES).nullable().optional()

/** Mapea valores legacy (numéricos, 'auto') al enum válido.
 *  Usar SOLO para migración o lectura de datos legacy, NO en requests nuevos. */
export function normalizeDifficulty(raw: string | null | undefined): ValidDifficulty {
  if (!raw) return 'medium'
  if ((VALID_DIFFICULTIES as readonly string[]).includes(raw)) return raw as ValidDifficulty
  const numericMap: Record<string, ValidDifficulty> = {
    '1': 'easy', '2': 'medium', '3': 'hard', '4': 'extreme', '5': 'extreme',
  }
  return numericMap[raw] ?? 'medium'
}
