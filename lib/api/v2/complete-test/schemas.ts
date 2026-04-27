// lib/api/v2/complete-test/schemas.ts
// Schemas para el endpoint de finalización de test server-side
import { z } from 'zod/v3'
import { VALID_DIFFICULTIES } from '@/lib/api/shared/difficulty'

// ============================================
// Sub-schemas reutilizables
// ============================================

// Device info opcional (para poder guardar rows desde el safety-net)
const deviceInfoSchema = z.object({
  userAgent: z.string().max(1000).default('unknown'),
  screenResolution: z.string().max(50).default('unknown'),
  deviceType: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).default('unknown'),
  browserLanguage: z.string().max(20).default('es'),
  timezone: z.string().max(100).default('Europe/Madrid'),
})

// ============================================
// Tipos de datos de analytics del cliente
// ============================================

const detailedAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  selectedAnswer: z.number().int().min(-1).max(4),
  isCorrect: z.boolean(),
  timeSpent: z.number().min(0).default(0),
  confidence: z.enum(['very_sure', 'sure', 'unsure', 'guessing', 'unknown']).default('unknown'),
  interactions: z.number().int().min(0).default(1),
  questionData: z.object({
    id: z.string().optional().nullable(),
    // Campos originales
    metadata: z.object({
      difficulty: z.enum(['easy', 'medium', 'hard', 'extreme']).optional().nullable(),
      // NUEVO: tags para safety-net insert
      tags: z.array(z.string()).optional().nullable(),
    }).optional().nullable(),
    article: z.object({
      id: z.string().optional().nullable(),
      number: z.string().optional().nullable(),
      law_short_name: z.string().optional().nullable(),
      // NUEVO: law_id para safety-net insert
      law_id: z.string().optional().nullable(),
    }).optional().nullable(),
    // NUEVO: campos opcionales para el safety-net insert server-side.
    // Si el cliente los envía, completeTest puede rellenar test_questions
    // cuando la cola de /answer-and-save no drenó a tiempo.
    question: z.string().optional().nullable(),
    options: z.array(z.string()).optional().nullable(),
    questionType: z.enum(['legislative', 'psychometric']).optional().nullable(),
    tema: z.number().int().min(0).optional().nullable(),
    explanation: z.string().optional().nullable(),
  }).optional().nullable(),
  // NUEVO: timing per-answer opcional para el safety-net
  questionStartTime: z.number().min(0).optional(),
  firstInteractionTime: z.number().min(0).optional(),
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

  // Respuestas detalladas (para analytics + safety-net insert)
  detailedAnswers: z.array(detailedAnswerSchema).min(1).max(500),

  // Tiempos
  startTime: z.number().min(0),

  // Eventos de interacción (para session_quality y engagement)
  interactionEvents: z.array(z.unknown()).max(500).default([]),

  // Sesión de usuario (para actualizar user_sessions)
  userSessionId: z.string().uuid().optional().nullable(),

  // Tema (para notificación y user_progress)
  tema: z.number().int().min(0).optional().nullable(),

  // NUEVO: datos opcionales para el safety-net insert
  // Si el cliente los envía, completeTest puede rellenar test_questions
  // cuando la cola de /answer-and-save no drenó a tiempo.
  oposicionId: z.string().optional().nullable(),
  deviceInfo: deviceInfoSchema.optional(),
})

export type CompleteTestRequest = z.infer<typeof completeTestRequestSchema>

// ============================================
// RESPONSE
// ============================================

export const completeTestResponseSchema = z.object({
  success: z.boolean(),
  status: z.enum(['saved', 'error']),
  savedQuestionsCount: z.number().int().min(0).optional(),
  // NUEVO: número de respuestas rellenadas por el safety-net (>0 si la cola del cliente falló)
  gapFilledCount: z.number().int().min(0).optional(),
})

export type CompleteTestResponse = z.infer<typeof completeTestResponseSchema>

// ============================================
// HELPERS
// ============================================

export function safeParseCompleteTestRequest(data: unknown) {
  return completeTestRequestSchema.safeParse(data)
}
