// lib/api/v2/complete-test/schemas.ts
// Schemas para el endpoint de finalización de test server-side
import { z } from 'zod/v3'

// ============================================
// Tipos de datos de analytics del cliente
// ============================================

const detailedAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  selectedAnswer: z.number().int().min(-1).max(3),
  isCorrect: z.boolean(),
  timeSpent: z.number().min(0).default(0),
  confidence: z.enum(['very_sure', 'sure', 'unsure', 'guessing', 'unknown']).default('unknown'),
  interactions: z.number().int().min(0).default(1),
  questionData: z.object({
    id: z.string().optional().nullable(),
    metadata: z.object({
      difficulty: z.enum(['easy', 'medium', 'hard', 'extreme']).optional().nullable(),
    }).optional().nullable(),
    article: z.object({
      id: z.string().optional().nullable(),
      number: z.string().optional().nullable(),
      law_short_name: z.string().optional().nullable(),
    }).optional().nullable(),
  }).optional().nullable(),
})

export type DetailedAnswerInput = z.infer<typeof detailedAnswerSchema>

// ============================================
// REQUEST
// ============================================

export const completeTestRequestSchema = z.object({
  // Identificadores
  sessionId: z.string().uuid('ID de sesión inválido'),

  // Resultado final
  finalScore: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),

  // Respuestas detalladas (para analytics)
  detailedAnswers: z.array(detailedAnswerSchema).min(1).max(500),

  // Tiempos
  startTime: z.number().min(0),

  // Eventos de interacción (para session_quality y engagement)
  interactionEvents: z.array(z.unknown()).max(500).default([]),

  // Sesión de usuario (para actualizar user_sessions)
  userSessionId: z.string().uuid().optional().nullable(),

  // Tema (para notificación y user_progress)
  tema: z.number().int().min(0).optional().nullable(),
})

export type CompleteTestRequest = z.infer<typeof completeTestRequestSchema>

// ============================================
// RESPONSE
// ============================================

export const completeTestResponseSchema = z.object({
  success: z.boolean(),
  status: z.enum(['saved', 'error']),
  savedQuestionsCount: z.number().int().min(0).optional(),
})

export type CompleteTestResponse = z.infer<typeof completeTestResponseSchema>

// ============================================
// HELPERS
// ============================================

export function safeParseCompleteTestRequest(data: unknown) {
  return completeTestRequestSchema.safeParse(data)
}
