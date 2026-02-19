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

// ============================================
// TEST DE REPASO DE FALLOS
// ============================================

export const failedQuestionsOrderSchema = z.enum([
  'recent',
  'most_failed',
  'worst_accuracy'
])

export type FailedQuestionsOrder = z.infer<typeof failedQuestionsOrderSchema>

export const createFailedQuestionsTestRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  numQuestions: z.number().int().min(1).max(100).default(10),
  orderBy: failedQuestionsOrderSchema.default('recent'),
  fromDate: z.string().datetime().optional(),
  days: z.number().int().min(1).max(365).optional(),
})

export type CreateFailedQuestionsTestRequest = z.infer<typeof createFailedQuestionsTestRequestSchema>

/** Pregunta formateada para TestLayout */
export const testLayoutQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string().min(1),
  question_text: z.string().optional(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  explanation: z.string().nullable(),
  difficulty: z.string().nullable(),
  primary_article_id: z.string().uuid().nullable(),
  article_number: z.string().nullable().optional(),
  article_title: z.string().nullable().optional(),
  law_name: z.string().nullable().optional(),
  law_slug: z.string().nullable().optional(),
  law_actual_slug: z.string().nullable().optional(),
  is_official_exam: z.boolean().optional(),
  exam_source: z.string().nullable().optional(),
  exam_date: z.string().nullable().optional(),
  exam_entity: z.string().nullable().optional(),
  global_difficulty_category: z.string().nullable().optional(),
  // Datos del artículo relacionado (de transformQuestions)
  article: z.object({
    id: z.string().nullable().optional(),
    number: z.string().nullable().optional(),
    article_number: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    law_name: z.string().nullable().optional(),
    law_short_name: z.string().nullable().optional(),
  }).nullable().optional(),
})

export type TestLayoutQuestion = z.infer<typeof testLayoutQuestionSchema>

export const createFailedQuestionsTestResponseSchema = z.object({
  success: z.boolean(),
  questions: z.array(testLayoutQuestionSchema).optional(),
  questionCount: z.number().int().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
})

export type CreateFailedQuestionsTestResponse = z.infer<typeof createFailedQuestionsTestResponseSchema>

// Validadores
export function safeParseCreateFailedQuestionsTest(data: unknown) {
  return createFailedQuestionsTestRequestSchema.safeParse(data)
}

export function safeParseTestLayoutQuestions(data: unknown) {
  return z.array(testLayoutQuestionSchema).safeParse(data)
}

// ============================================
// CONFIG DE TEST LAYOUT
// ============================================

export const testConfigSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  subtitle: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  isLawTest: z.boolean().optional(),
  customNavigationLinks: z.object({
    backToLaw: z.object({
      href: z.string(),
      text: z.string(),
    }).optional(),
  }).optional(),
})

export type TestConfig = z.infer<typeof testConfigSchema>
