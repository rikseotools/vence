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

// Validators
export function safeParseGetOfficialExamQuestions(data: unknown) {
  return getOfficialExamQuestionsRequestSchema.safeParse(data)
}

export function safeParseSaveOfficialExamResults(data: unknown) {
  return saveOfficialExamResultsRequestSchema.safeParse(data)
}
