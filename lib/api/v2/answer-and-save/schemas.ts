// lib/api/v2/answer-and-save/schemas.ts
// Schemas para el endpoint unificado: validar + guardar respuesta
import { z } from 'zod/v3'
import { VALID_DIFFICULTIES } from '@/lib/api/shared/difficulty'

// ============================================
// REQUEST
// ============================================

export const answerAndSaveRequestSchema = z.object({
  // Identificadores
  questionId: z.string().uuid('ID de pregunta inválido'),
  userAnswer: z.number().int().min(0).max(3), // 0=A, 1=B, 2=C, 3=D

  // Sesión de test (obligatorio para guardar)
  sessionId: z.string().uuid('ID de sesión inválido'),
  questionIndex: z.number().int().min(0),

  // Contexto de la pregunta (para guardar en test_questions)
  questionText: z.string().min(1),
  options: z.array(z.string()).min(2).max(6),
  tema: z.number().int().min(0).default(0),
  questionType: z.enum(['legislative', 'psychometric']).default('legislative'),
  article: z.object({
    id: z.string().uuid().optional().nullable(),
    number: z.string().optional().nullable(),
    law_id: z.string().uuid().optional().nullable(),
    law_short_name: z.string().optional().nullable(),
  }).optional().nullable(),
  metadata: z.object({
    id: z.string().optional().nullable(),
    difficulty: z.enum(VALID_DIFFICULTIES).nullable().optional(),
    question_type: z.string().optional().nullable(),
    tags: z.array(z.string()).optional().nullable(),
  }).optional().nullable(),
  explanation: z.string().optional().nullable(),

  // Métricas de comportamiento
  timeSpent: z.number().min(0).default(0),
  confidenceLevel: z.enum(['very_sure', 'sure', 'unsure', 'guessing', 'unknown']).default('unknown'),
  interactionCount: z.number().int().min(0).default(1),
  questionStartTime: z.number().min(0).default(0),
  firstInteractionTime: z.number().min(0).default(0),

  // Eventos (limitados para no saturar)
  interactionEvents: z.array(z.unknown()).max(10).default([]),
  mouseEvents: z.array(z.unknown()).max(50).default([]),
  scrollEvents: z.array(z.unknown()).max(50).default([]),

  // Dispositivo
  deviceInfo: z.object({
    userAgent: z.string().max(1000).default('unknown'),
    screenResolution: z.string().max(50).default('unknown'),
    deviceType: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).default('unknown'),
    browserLanguage: z.string().max(20).default('es'),
    timezone: z.string().max(100).default('Europe/Madrid'),
  }).optional(),

  // Oposición del usuario (para resolver tema)
  oposicionId: z.string().optional().nullable(),

  // Score actual antes de esta respuesta (para calcular nuevo score)
  currentScore: z.number().int().min(0).default(0),
})

export type AnswerAndSaveRequest = z.infer<typeof answerAndSaveRequestSchema>

// ============================================
// RESPONSE
// ============================================

export const answerAndSaveResponseSchema = z.object({
  success: z.boolean(),
  // Resultado de la validación
  isCorrect: z.boolean(),
  correctAnswer: z.number().int().min(0).max(3),
  explanation: z.string().nullable().optional(),
  articleNumber: z.string().nullable().optional(),
  lawShortName: z.string().nullable().optional(),
  lawName: z.string().nullable().optional(),
  // Resultado del guardado
  newScore: z.number().int().min(0),
  saveAction: z.enum(['saved_new', 'already_saved', 'save_failed']),
  questionDbId: z.string().nullable().optional(),
})

export type AnswerAndSaveResponse = z.infer<typeof answerAndSaveResponseSchema>

// ============================================
// HELPERS
// ============================================

export function safeParseAnswerAndSaveRequest(data: unknown) {
  return answerAndSaveRequestSchema.safeParse(data)
}
