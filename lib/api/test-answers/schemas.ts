// lib/api/test-answers/schemas.ts - Schemas de validacion para guardar respuestas
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'
import { difficultyInputSchema } from '@/lib/api/shared/difficulty'

// ============================================
// SUB-SCHEMAS
// ============================================

export const deviceInfoSchema = z.object({
  userAgent: z.string().max(1000).default('unknown'),
  screenResolution: z.string().max(50).default('unknown'),
  deviceType: z.enum(['mobile', 'tablet', 'desktop', 'unknown']).default('unknown'),
  browserLanguage: z.string().max(20).default('es'),
  timezone: z.string().max(100).default('Europe/Madrid'),
})

export type DeviceInfo = z.infer<typeof deviceInfoSchema>

export const articleDataSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  number: z.string().optional().nullable(),
  law_id: z.string().uuid().optional().nullable(),
  law_short_name: z.string().optional().nullable(),
}).optional().nullable()

export const questionMetadataSchema = z.object({
  id: z.string().optional().nullable(),
  difficulty: difficultyInputSchema,
  question_type: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
}).optional().nullable()

export const questionDataSchema = z.object({
  id: z.string().optional().nullable(),
  question: z.string().min(1, 'Texto de pregunta requerido'),
  options: z.array(z.string()).min(2).max(6),
  tema: z.number().int().min(0).optional().nullable(),
  questionType: z.enum(['legislative', 'psychometric']).default('legislative'),
  article: articleDataSchema,
  metadata: questionMetadataSchema,
  explanation: z.string().optional().nullable(),
})

export type QuestionData = z.infer<typeof questionDataSchema>

export const answerDataSchema = z.object({
  questionIndex: z.number().int().min(0),
  selectedAnswer: z.number().int().min(-1).max(3), // -1 = sin respuesta
  correctAnswer: z.number().int().min(0).max(3),
  isCorrect: z.boolean(),
  timeSpent: z.number().min(0).default(0),
})

export type AnswerData = z.infer<typeof answerDataSchema>

// ============================================
// REQUEST PRINCIPAL
// ============================================

export const saveAnswerRequestSchema = z.object({
  sessionId: z.string().uuid('ID de sesion invalido'),
  questionData: questionDataSchema,
  answerData: answerDataSchema,
  tema: z.number().int().min(0).default(0),
  confidenceLevel: z.enum(['very_sure', 'sure', 'unsure', 'guessing', 'unknown']).default('unknown'),
  interactionCount: z.number().int().min(0).default(1),
  questionStartTime: z.number().min(0).default(0),
  firstInteractionTime: z.number().min(0).default(0),
  interactionEvents: z.array(z.unknown()).max(10).default([]),
  mouseEvents: z.array(z.unknown()).max(50).default([]),
  scrollEvents: z.array(z.unknown()).max(50).default([]),
  deviceInfo: deviceInfoSchema.optional(),
  oposicionId: z.string().optional().nullable(),
})

export type SaveAnswerRequest = z.infer<typeof saveAnswerRequestSchema>

// ============================================
// RESPONSE
// ============================================

export const saveAnswerResponseSchema = z.object({
  success: z.boolean(),
  question_id: z.string().optional().nullable(),
  action: z.enum(['saved_new', 'already_saved', 'error']),
  error: z.string().optional().nullable(),
})

export type SaveAnswerResponse = z.infer<typeof saveAnswerResponseSchema>

// ============================================
// HELPERS
// ============================================

export function safeParseSaveAnswerRequest(data: unknown) {
  return saveAnswerRequestSchema.safeParse(data)
}
