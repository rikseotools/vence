// lib/api/simulacro/schemas.ts
// Schemas Zod para el endpoint del Simulacro de Examen.
//
// Un simulacro replica la distribución oficial del examen de una oposición
// pero usando preguntas ALEATORIAS del catálogo (vs un examen oficial concreto
// que usa preguntas fijas de una convocatoria histórica).

import { z } from 'zod/v3'
import type { OfficialExamQuestion } from '../official-exams/schemas'

// ============================================
// REQUEST
// ============================================

export const getSimulacroQuestionsRequestSchema = z.object({
  oposicion: z.string().min(1, 'oposicion requerido'),
})

export type GetSimulacroQuestionsRequest = z.infer<
  typeof getSimulacroQuestionsRequestSchema
>

export function safeParseGetSimulacroQuestions(input: unknown) {
  return getSimulacroQuestionsRequestSchema.safeParse(input)
}

// ============================================
// RESPONSE
// ============================================
// Reutilizamos OfficialExamQuestion (mismo formato) para que el componente
// OfficialExamLayout funcione sin cambios.

export interface SimulacroMetadata {
  isSimulacro: true
  totalQuestions: number
  durationMinutes: number
  legislativeCount: number
  psychometricCount: number
  reservaCount: number
  // Cada línea es un bloque del examen oficial con su desglose por tipo.
  // Ej: "Bloque I — Programa oficial: 30 preguntas legislativas + 30 psicotécnicas"
  //     "Bloque II — Ofimática: 50 preguntas legislativas"
  breakdown: string[]
}

export type GetSimulacroQuestionsResponse =
  | {
      success: true
      questions: OfficialExamQuestion[]
      metadata: SimulacroMetadata
    }
  | {
      success: false
      error: string
    }
