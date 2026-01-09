// lib/api/tests/schemas.ts - Schemas de validación para tests
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// RESPUESTA DETALLADA (para test recuperado)
// ============================================

export const detailedAnswerSchema = z.object({
  questionIndex: z.number().int().min(0),
  selectedAnswer: z.number().int().min(0).max(3),
  correctAnswer: z.number().int().min(0).max(3),
  isCorrect: z.boolean(),
  timeSpent: z.number().int().min(0),
  timestamp: z.string(),
  questionData: z.object({
    id: z.string().uuid().optional().nullable(),
    question: z.string().optional(),
    options: z.array(z.string()).optional(),
    correct: z.number().optional(),
    article: z.object({
      id: z.string().optional().nullable(),
      number: z.string().optional().nullable(),
      law_short_name: z.string().optional().nullable(),
    }).optional().nullable(),
    metadata: z.record(z.unknown()).optional().nullable(),
  }).optional().nullable(),
  confidence: z.string().nullable().optional(),
  interactions: z.number().optional(),
})

export type DetailedAnswer = z.infer<typeof detailedAnswerSchema>

// ============================================
// PREGUNTA RESPONDIDA
// ============================================

export const answeredQuestionSchema = z.object({
  question: z.number().int().min(0),
  selectedAnswer: z.number().int().min(0).max(3),
  correct: z.boolean(),
  timestamp: z.string(),
})

export type AnsweredQuestion = z.infer<typeof answeredQuestionSchema>

// ============================================
// TEST PENDIENTE (localStorage)
// ============================================

export const pendingTestSchema = z.object({
  tema: z.number().int(),
  testNumber: z.number().int().optional(),
  config: z.record(z.unknown()).optional(),
  questions: z.array(z.object({
    id: z.string().uuid().optional().nullable(),
    question: z.string().optional(),
    options: z.array(z.string()).optional(),
    correct: z.number().optional(),
    article: z.record(z.unknown()).optional().nullable(),
    metadata: z.record(z.unknown()).optional().nullable(),
  })).optional(),
  currentQuestion: z.number().int().min(0),
  answeredQuestions: z.array(answeredQuestionSchema),
  score: z.number().int().min(0),
  detailedAnswers: z.array(detailedAnswerSchema),
  startTime: z.number(),
  savedAt: z.number(),
  pageUrl: z.string().optional(),
})

export type PendingTest = z.infer<typeof pendingTestSchema>

// ============================================
// REQUEST: RECUPERAR TEST
// ============================================

export const recoverTestRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  pendingTest: pendingTestSchema,
})

export type RecoverTestRequest = z.infer<typeof recoverTestRequestSchema>

// ============================================
// RESPONSE: RECUPERAR TEST
// ============================================

export const recoverTestResponseSchema = z.object({
  success: z.boolean(),
  testId: z.string().uuid().optional(),
  totalQuestions: z.number().int().optional(),
  correctAnswers: z.number().int().optional(),
  incorrectAnswers: z.number().int().optional(),
  percentage: z.number().int().min(0).max(100).optional(),
  totalTimeSeconds: z.number().int().optional(),
  tema: z.number().int().optional(),
  needsOnboarding: z.boolean().optional(),
  error: z.string().optional(),
})

export type RecoverTestResponse = z.infer<typeof recoverTestResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function validateRecoverTest(data: unknown): RecoverTestRequest {
  return recoverTestRequestSchema.parse(data)
}

export function safeParseRecoverTest(data: unknown) {
  return recoverTestRequestSchema.safeParse(data)
}

export function safeParsePendingTest(data: unknown) {
  return pendingTestSchema.safeParse(data)
}
