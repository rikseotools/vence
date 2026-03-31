// lib/api/exam/schemas.ts - Schemas de validación para la API de exámenes
import { z } from 'zod'
import { VALID_DIFFICULTIES } from '@/lib/api/shared/difficulty'

// ============================================
// GUARDAR RESPUESTA INDIVIDUAL
// ============================================

export const saveAnswerRequestSchema = z.object({
  testId: z.string().uuid('ID de test inválido'),
  questionId: z.string().uuid('ID de pregunta inválido').optional().nullable(),
  questionOrder: z.number().int().min(1, 'Orden de pregunta inválido'),
  userAnswer: z.enum(['a', 'b', 'c', 'd']),
  // correctAnswer es opcional porque en modo examen se guarda en /api/exam/init
  // y se recupera del registro existente al actualizar la respuesta del usuario
  correctAnswer: z.enum(['a', 'b', 'c', 'd']).optional(),
  questionText: z.string().optional().default(''),
  // Datos opcionales de la pregunta
  articleId: z.string().uuid().optional().nullable(),
  articleNumber: z.string().optional().nullable(),
  lawName: z.string().optional().nullable(),
  temaNumber: z.number().int().optional().nullable(),
  difficulty: z.enum(VALID_DIFFICULTIES).optional().nullable(),
  // Métricas de tiempo
  timeSpentSeconds: z.number().int().min(0).default(0),
  confidenceLevel: z.enum(['very_sure', 'sure', 'unsure', 'guessing']).optional().nullable(),
})

export type SaveAnswerRequest = z.infer<typeof saveAnswerRequestSchema>

export const saveAnswerResponseSchema = z.object({
  success: z.boolean(),
  answerId: z.string().uuid().optional(),
  isCorrect: z.boolean().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
})

export type SaveAnswerResponse = z.infer<typeof saveAnswerResponseSchema>

// ============================================
// OBTENER PROGRESO DE EXAMEN
// ============================================

export const getExamProgressRequestSchema = z.object({
  testId: z.string().uuid('ID de test inválido'),
})

export type GetExamProgressRequest = z.infer<typeof getExamProgressRequestSchema>

export const examAnswerSchema = z.object({
  questionOrder: z.number(),
  userAnswer: z.string(),
  correctAnswer: z.string(),
  isCorrect: z.boolean(),
  questionId: z.string().uuid().nullable(),
  timeSpentSeconds: z.number().nullable(),
})

export const getExamProgressResponseSchema = z.object({
  success: z.boolean(),
  testId: z.string().uuid().optional(),
  totalQuestions: z.number().optional(),
  answeredQuestions: z.number().optional(),
  score: z.number().optional(),
  isCompleted: z.boolean().optional(),
  answers: z.array(examAnswerSchema).optional(),
  error: z.string().optional(),
})

export type GetExamProgressResponse = z.infer<typeof getExamProgressResponseSchema>

// ============================================
// OBTENER EXÁMENES PENDIENTES
// ============================================

export const getPendingExamsRequestSchema = z.object({
  userId: z.string().uuid('ID de usuario inválido'),
  testType: z.enum(['exam', 'practice']).optional(),
  limit: z.number().int().min(1).max(50).default(10),
})

export type GetPendingExamsRequest = z.infer<typeof getPendingExamsRequestSchema>

export const pendingExamSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  testType: z.string(),
  totalQuestions: z.number(),
  answeredQuestions: z.number(),
  score: z.number(),
  createdAt: z.string(),
  temaNumber: z.number().nullable(),
  // Porcentaje de progreso
  progress: z.number(),
})

export const getPendingExamsResponseSchema = z.object({
  success: z.boolean(),
  exams: z.array(pendingExamSchema).optional(),
  total: z.number().optional(),
  error: z.string().optional(),
})

export type GetPendingExamsResponse = z.infer<typeof getPendingExamsResponseSchema>

// ============================================
// COMPLETAR/FINALIZAR EXAMEN
// ============================================

export const completeExamRequestSchema = z.object({
  testId: z.string().uuid('ID de test inválido'),
  // Forzar completar aunque falten preguntas
  force: z.boolean().default(false),
})

export type CompleteExamRequest = z.infer<typeof completeExamRequestSchema>

export const completeExamResponseSchema = z.object({
  success: z.boolean(),
  testId: z.string().uuid().optional(),
  finalScore: z.number().optional(),
  totalQuestions: z.number().optional(),
  correctAnswers: z.number().optional(),
  incorrectAnswers: z.number().optional(),
  unanswered: z.number().optional(),
  isCompleted: z.boolean().optional(),
  error: z.string().optional(),
})

export type CompleteExamResponse = z.infer<typeof completeExamResponseSchema>

// ============================================
// VALIDADORES HELPER
// ============================================

export function validateSaveAnswerRequest(data: unknown): SaveAnswerRequest {
  return saveAnswerRequestSchema.parse(data)
}

export function validateGetExamProgressRequest(data: unknown): GetExamProgressRequest {
  return getExamProgressRequestSchema.parse(data)
}

export function validateGetPendingExamsRequest(data: unknown): GetPendingExamsRequest {
  return getPendingExamsRequestSchema.parse(data)
}

export function validateCompleteExamRequest(data: unknown): CompleteExamRequest {
  return completeExamRequestSchema.parse(data)
}

// ============================================
// REANUDAR EXAMEN
// ============================================

export const resumeExamRequestSchema = z.object({
  testId: z.string().uuid('ID de test inválido'),
  userId: z.string().uuid('ID de usuario inválido').optional(),
})

export type ResumeExamRequest = z.infer<typeof resumeExamRequestSchema>

export const resumedQuestionSchema = z.object({
  id: z.string().uuid(),
  question_text: z.string(),
  option_a: z.string(),
  option_b: z.string(),
  option_c: z.string(),
  option_d: z.string(),
  difficulty: z.string().nullable().optional(),
  is_official_exam: z.boolean().nullable().optional(),
  primary_article_id: z.string().uuid().nullable().optional(),
  articles: z.any().nullable().optional(),
})

export const resumeExamResponseSchema = z.object({
  success: z.boolean(),
  testId: z.string().uuid().optional(),
  temaNumber: z.number().nullable().optional(),
  totalQuestions: z.number().optional(),
  answeredCount: z.number().optional(),
  questions: z.array(resumedQuestionSchema).optional(),
  savedAnswers: z.record(z.string(), z.string()).optional(),
  error: z.string().optional(),
})

export type ResumeExamResponse = z.infer<typeof resumeExamResponseSchema>

// ============================================
// VALIDADORES HELPER
// ============================================

// Validador seguro que retorna resultado en vez de lanzar error
export function safeParseSaveAnswerRequest(data: unknown) {
  return saveAnswerRequestSchema.safeParse(data)
}

export function safeParseGetExamProgressRequest(data: unknown) {
  return getExamProgressRequestSchema.safeParse(data)
}

export function safeParseResumeExamRequest(data: unknown) {
  return resumeExamRequestSchema.safeParse(data)
}

// ============================================
// VALIDACIÓN BATCH DE EXAMEN (client-side)
// ============================================

export const validatedQuestionResultSchema = z.object({
  questionId: z.string(),
  userAnswer: z.string().nullable(),
  correctAnswer: z.string(),
  correctIndex: z.number(),
  isCorrect: z.boolean(),
  explanation: z.string().nullable().optional()
})

export type ValidatedQuestionResult = z.infer<typeof validatedQuestionResultSchema>

export const validatedResultsSchema = z.object({
  success: z.boolean(),
  results: z.array(validatedQuestionResultSchema),
  summary: z.object({
    totalQuestions: z.number(),
    totalAnswered: z.number(),
    totalCorrect: z.number(),
    percentage: z.number()
  })
})

export type ValidatedResults = z.infer<typeof validatedResultsSchema>
