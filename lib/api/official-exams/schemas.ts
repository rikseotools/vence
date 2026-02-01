import { z } from 'zod'

// Available positions for official exams
export const OposicionType = {
  AUXILIAR_ADMINISTRATIVO_ESTADO: 'auxiliar-administrativo-estado',
  TRAMITACION_PROCESAL: 'tramitacion-procesal',
  AUXILIO_JUDICIAL: 'auxilio-judicial',
} as const

export type OposicionType = typeof OposicionType[keyof typeof OposicionType]

// Request schema for getting official exam questions
export const getOfficialExamQuestionsRequestSchema = z.object({
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  oposicion: z.enum([
    OposicionType.AUXILIAR_ADMINISTRATIVO_ESTADO,
    OposicionType.TRAMITACION_PROCESAL,
    OposicionType.AUXILIO_JUDICIAL,
  ]),
  parte: z.enum(['primera', 'segunda']).optional(),
  includeReservas: z.boolean().default(true),
})

export type GetOfficialExamQuestionsRequest = z.infer<typeof getOfficialExamQuestionsRequestSchema>

// Question item schema (without correct_option for security)
export const officialExamQuestionSchema = z.object({
  id: z.string().uuid(),
  questionText: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  explanation: z.string().nullable(),
  difficulty: z.string().nullable(),
  questionType: z.enum(['legislative', 'psychometric']),
  questionSubtype: z.string().nullable(),
  examSource: z.string().nullable(),
  isReserva: z.boolean(),
  // For psychometric questions with tables/content
  contentData: z.record(z.string(), z.unknown()).nullable(),
  timeLimitSeconds: z.number().nullable(),
  // Article info for legislative questions
  articleNumber: z.string().nullable(),
  lawName: z.string().nullable(),
})

export type OfficialExamQuestion = z.infer<typeof officialExamQuestionSchema>

// Response schema
export const getOfficialExamQuestionsResponseSchema = z.object({
  success: z.boolean(),
  questions: z.array(officialExamQuestionSchema).optional(),
  metadata: z.object({
    examDate: z.string(),
    oposicion: z.string(),
    parte: z.string().nullable(),
    totalQuestions: z.number(),
    legislativeCount: z.number(),
    psychometricCount: z.number(),
    reservaCount: z.number(),
    anuladasCount: z.number(),
  }).optional(),
  error: z.string().optional(),
})

export type GetOfficialExamQuestionsResponse = z.infer<typeof getOfficialExamQuestionsResponseSchema>

// Available exams list schema
export const officialExamSummarySchema = z.object({
  examDate: z.string(),
  examSource: z.string(),
  oposicion: z.string(),
  totalQuestions: z.number(),
  partes: z.array(z.string()),
})

export type OfficialExamSummary = z.infer<typeof officialExamSummarySchema>

export const getAvailableExamsResponseSchema = z.object({
  success: z.boolean(),
  exams: z.array(officialExamSummarySchema).optional(),
  error: z.string().optional(),
})

export type GetAvailableExamsResponse = z.infer<typeof getAvailableExamsResponseSchema>

// =====================================================
// SAVE RESULTS SCHEMAS
// =====================================================

// Individual question result schema
export const questionResultSchema = z.object({
  questionId: z.string().uuid(),
  questionType: z.enum(['legislative', 'psychometric']),
  userAnswer: z.string(),
  correctAnswer: z.string(),
  isCorrect: z.boolean(),
  questionText: z.string(),
  articleNumber: z.string().nullable().optional(),
  lawName: z.string().nullable().optional(),
  difficulty: z.string().default('medium'),
})

export type QuestionResult = z.infer<typeof questionResultSchema>

// Save results request schema
export const saveOfficialExamResultsRequestSchema = z.object({
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  oposicion: z.enum([
    OposicionType.AUXILIAR_ADMINISTRATIVO_ESTADO,
    OposicionType.TRAMITACION_PROCESAL,
    OposicionType.AUXILIO_JUDICIAL,
  ]),
  parte: z.enum(['primera', 'segunda']).optional(),
  results: z.array(questionResultSchema).min(1, 'Debe haber al menos un resultado'),
  totalTimeSeconds: z.number().int().min(0),
  metadata: z.object({
    legislativeCount: z.number().int().min(0),
    psychometricCount: z.number().int().min(0),
    reservaCount: z.number().int().min(0).optional(),
  }).optional(),
})

export type SaveOfficialExamResultsRequest = z.infer<typeof saveOfficialExamResultsRequestSchema>

// Save results response schema
export const saveOfficialExamResultsResponseSchema = z.object({
  success: z.boolean(),
  testId: z.string().uuid().optional(),
  questionsSaved: z.number().optional(),
  error: z.string().optional(),
})

export type SaveOfficialExamResultsResponse = z.infer<typeof saveOfficialExamResultsResponseSchema>

// =====================================================
// INIT EXAM SESSION SCHEMAS
// =====================================================

// Question item for init (with questionType to identify table)
export const initOfficialExamQuestionSchema = z.object({
  id: z.string().uuid(),
  questionType: z.enum(['legislative', 'psychometric']),
  questionOrder: z.number().int().min(1),
  questionText: z.string(),
  questionSubtype: z.string().nullable().optional(),
  contentData: z.record(z.string(), z.unknown()).nullable().optional(),
  // Article info (legislative only)
  articleNumber: z.string().nullable().optional(),
  lawName: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
})

export type InitOfficialExamQuestion = z.infer<typeof initOfficialExamQuestionSchema>

export const initOfficialExamRequestSchema = z.object({
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  oposicion: z.enum([
    OposicionType.AUXILIAR_ADMINISTRATIVO_ESTADO,
    OposicionType.TRAMITACION_PROCESAL,
    OposicionType.AUXILIO_JUDICIAL,
  ]),
  parte: z.enum(['primera', 'segunda']).optional(),
  questions: z.array(initOfficialExamQuestionSchema).min(1, 'Debe haber al menos una pregunta'),
  metadata: z.object({
    legislativeCount: z.number().int().min(0).optional(),
    psychometricCount: z.number().int().min(0).optional(),
    reservaCount: z.number().int().min(0).optional(),
  }).optional(),
})

export type InitOfficialExamRequest = z.infer<typeof initOfficialExamRequestSchema>

export const initOfficialExamResponseSchema = z.object({
  success: z.boolean(),
  testId: z.string().uuid().optional(),
  savedCount: z.number().optional(),
  error: z.string().optional(),
})

export type InitOfficialExamResponse = z.infer<typeof initOfficialExamResponseSchema>

// =====================================================
// SAVE INDIVIDUAL ANSWER SCHEMAS
// =====================================================

export const saveOfficialExamAnswerRequestSchema = z.object({
  testId: z.string().uuid(),
  questionOrder: z.number().int().min(1),
  userAnswer: z.enum(['a', 'b', 'c', 'd']),
})

export type SaveOfficialExamAnswerRequest = z.infer<typeof saveOfficialExamAnswerRequestSchema>

export const saveOfficialExamAnswerResponseSchema = z.object({
  success: z.boolean(),
  answerId: z.string().uuid().optional(),
  error: z.string().optional(),
})

export type SaveOfficialExamAnswerResponse = z.infer<typeof saveOfficialExamAnswerResponseSchema>

// =====================================================
// RESUME EXAM SCHEMAS
// =====================================================

export const resumeOfficialExamRequestSchema = z.object({
  testId: z.string().uuid(),
})

export type ResumeOfficialExamRequest = z.infer<typeof resumeOfficialExamRequestSchema>

// Question with saved answer for resume (NO correct_option for security)
export const resumedOfficialExamQuestionSchema = z.object({
  id: z.string().uuid(),
  questionOrder: z.number(),
  questionText: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  explanation: z.string().nullable(),
  difficulty: z.string().nullable(),
  questionType: z.enum(['legislative', 'psychometric']),
  questionSubtype: z.string().nullable(),
  contentData: z.record(z.string(), z.unknown()).nullable(),
  isReserva: z.boolean(),
  articleNumber: z.string().nullable(),
  lawName: z.string().nullable(),
  // User's saved answer (null if not answered)
  savedAnswer: z.string().nullable(),
})

export type ResumedOfficialExamQuestion = z.infer<typeof resumedOfficialExamQuestionSchema>

export const resumeOfficialExamResponseSchema = z.object({
  success: z.boolean(),
  testId: z.string().uuid().optional(),
  questions: z.array(resumedOfficialExamQuestionSchema).optional(),
  savedAnswers: z.record(z.string(), z.string()).optional(), // { "0": "a", "3": "c", ... }
  metadata: z.object({
    examDate: z.string(),
    oposicion: z.string(),
    totalQuestions: z.number(),
    answeredCount: z.number(),
    legislativeCount: z.number(),
    psychometricCount: z.number(),
    reservaCount: z.number(),
    createdAt: z.string(),
  }).optional(),
  error: z.string().optional(),
})

export type ResumeOfficialExamResponse = z.infer<typeof resumeOfficialExamResponseSchema>

// =====================================================
// PENDING EXAMS SCHEMAS
// =====================================================

export const getPendingOfficialExamsRequestSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
})

export type GetPendingOfficialExamsRequest = z.infer<typeof getPendingOfficialExamsRequestSchema>

export const pendingOfficialExamSchema = z.object({
  id: z.string().uuid(),
  examDate: z.string(),
  oposicion: z.string(),
  totalQuestions: z.number(),
  answeredCount: z.number(),
  progress: z.number(), // Percentage 0-100
  createdAt: z.string(),
})

export type PendingOfficialExam = z.infer<typeof pendingOfficialExamSchema>

export const getPendingOfficialExamsResponseSchema = z.object({
  success: z.boolean(),
  exams: z.array(pendingOfficialExamSchema).optional(),
  total: z.number().optional(),
  error: z.string().optional(),
})

export type GetPendingOfficialExamsResponse = z.infer<typeof getPendingOfficialExamsResponseSchema>

// =====================================================
// VALIDATORS
// =====================================================

export function safeParseGetOfficialExamQuestions(data: unknown) {
  return getOfficialExamQuestionsRequestSchema.safeParse(data)
}

export function safeParseSaveOfficialExamResults(data: unknown) {
  return saveOfficialExamResultsRequestSchema.safeParse(data)
}

export function safeParseInitOfficialExam(data: unknown) {
  return initOfficialExamRequestSchema.safeParse(data)
}

export function safeParseSaveOfficialExamAnswer(data: unknown) {
  return saveOfficialExamAnswerRequestSchema.safeParse(data)
}

export function safeParseResumeOfficialExam(data: unknown) {
  return resumeOfficialExamRequestSchema.safeParse(data)
}

export function safeParseGetPendingOfficialExams(data: unknown) {
  return getPendingOfficialExamsRequestSchema.safeParse(data)
}

// =====================================================
// FAILED QUESTIONS SCHEMAS (for review/retry)
// =====================================================

export const getOfficialExamFailedQuestionsRequestSchema = z.object({
  userId: z.string().uuid(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  parte: z.enum(['primera', 'segunda']).optional(),
  oposicion: z.enum([
    OposicionType.AUXILIAR_ADMINISTRATIVO_ESTADO,
    OposicionType.TRAMITACION_PROCESAL,
    OposicionType.AUXILIO_JUDICIAL,
  ]),
})

export type GetOfficialExamFailedQuestionsRequest = z.infer<typeof getOfficialExamFailedQuestionsRequestSchema>

export const officialExamFailedQuestionSchema = z.object({
  id: z.string().uuid(),
  questionText: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  userAnswer: z.string(),
  correctAnswer: z.string(),
  explanation: z.string().nullable(),
  questionType: z.enum(['legislative', 'psychometric']),
  questionSubtype: z.string().nullable(),
  contentData: z.record(z.string(), z.unknown()).nullable(),
  articleNumber: z.string().nullable(),
  lawName: z.string().nullable(),
  difficulty: z.string().nullable(),
  primaryArticleId: z.string().uuid().nullable().optional(),
})

export type OfficialExamFailedQuestion = z.infer<typeof officialExamFailedQuestionSchema>

export const getOfficialExamFailedQuestionsResponseSchema = z.object({
  success: z.boolean(),
  questions: z.array(officialExamFailedQuestionSchema).optional(),
  totalFailed: z.number().optional(),
  examDate: z.string().optional(),
  parte: z.string().nullable().optional(),
  oposicion: z.string().optional(),
  error: z.string().optional(),
})

export type GetOfficialExamFailedQuestionsResponse = z.infer<typeof getOfficialExamFailedQuestionsResponseSchema>

export function safeParseGetOfficialExamFailedQuestions(data: unknown) {
  return getOfficialExamFailedQuestionsRequestSchema.safeParse(data)
}
