// lib/api/test-review/schemas.ts - Schemas de validación para revisión de tests
// Usar zod/v3 para compatibilidad con Zod 4
import { z } from 'zod/v3'

// ============================================
// REQUEST: OBTENER REVISIÓN DE TEST
// ============================================

// `requesterId` es el id del TOKEN, nunca uno que llegue del cliente: lo pone la ruta tras
// `requireUsuarioPropio`. Va en el request —y no como parámetro suelto— para que sea
// imposible llamar a `getTestReview` sin decir quién pregunta (T-482: se podía leer el
// examen de cualquiera con solo el UUID, que viaja en la URL del navegador).
export const getTestReviewRequestSchema = z.object({
  testId: z.string().uuid('ID de test inválido'),
  requesterId: z.string().uuid('ID de usuario inválido'),
})

export type GetTestReviewRequest = z.infer<typeof getTestReviewRequestSchema>

// ============================================
// PREGUNTA EN REVISIÓN
// ============================================

export const reviewQuestionSchema = z.object({
  id: z.string().uuid(),
  order: z.number().int().min(1),
  questionText: z.string(),
  options: z.array(z.string()),
  difficulty: z.string().nullable(),
  tema: z.number().int().nullable(),
  articleNumber: z.string().nullable(),
  lawName: z.string().nullable(),
  explanation: z.string().nullable(),
  article: z.string().nullable(), // article_full from context
  isPsychometric: z.boolean(),
  // Imagen / contenido visual (figuras psicotécnicas, gráficos, tablas).
  // El texto solo no basta cuando la pregunta hace referencia a un símbolo
  // o figura (ej. "¿Cuántas ⬂ hay en total?" — bug Nila 17/05).
  imageUrl: z.string().nullable(),
  contentData: z.unknown().nullable(),
  // Datos de la respuesta del usuario
  userAnswer: z.string().nullable(), // 'A', 'B', 'C', 'D' o null (en blanco)
  correctAnswer: z.string(), // 'A', 'B', 'C', 'D'
  isCorrect: z.boolean(),
  timeSpent: z.number().int().min(0),
})

export type ReviewQuestion = z.infer<typeof reviewQuestionSchema>

// ============================================
// DATOS DEL TEST
// ============================================

export const testInfoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  testType: z.string().nullable(),
  tema: z.number().int().nullable(),
  createdAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  totalTimeSeconds: z.number().int(),
})

export type TestInfo = z.infer<typeof testInfoSchema>

// ============================================
// RESUMEN DE RESULTADOS
// ============================================

export const testSummarySchema = z.object({
  totalQuestions: z.number().int(),
  correctCount: z.number().int(),
  incorrectCount: z.number().int(),
  blankCount: z.number().int(),
  score: z.string().nullable(),
  percentage: z.number().int().min(0).max(100),
})

export type TestSummary = z.infer<typeof testSummarySchema>

// ============================================
// BREAKDOWN POR TEMA
// ============================================

export const temaBreakdownSchema = z.object({
  tema: z.number().int(),
  total: z.number().int(),
  correct: z.number().int(),
  accuracy: z.number().int().min(0).max(100),
})

export type TemaBreakdown = z.infer<typeof temaBreakdownSchema>

// ============================================
// BREAKDOWN POR DIFICULTAD
// ============================================

export const difficultyBreakdownSchema = z.object({
  difficulty: z.string(),
  total: z.number().int(),
  correct: z.number().int(),
  accuracy: z.number().int().min(0).max(100),
})

export type DifficultyBreakdown = z.infer<typeof difficultyBreakdownSchema>

// ============================================
// RESPONSE: OBTENER REVISIÓN DE TEST
// ============================================

export const getTestReviewResponseSchema = z.object({
  success: z.boolean(),
  test: testInfoSchema.optional(),
  summary: testSummarySchema.optional(),
  temaBreakdown: z.array(temaBreakdownSchema).optional(),
  difficultyBreakdown: z.array(difficultyBreakdownSchema).optional(),
  questions: z.array(reviewQuestionSchema).optional(),
  examCase: z.object({
    id: z.string(),
    caseText: z.string(),
    caseTitle: z.string().nullable(),
  }).nullable().optional(),
  error: z.string().optional(),
  // Motivo tipado del fallo. El route lo traduce a HTTP; antes se comparaba el TEXTO del
  // error para elegir el status (`error === 'Test no encontrado' ? 404 : 400`), que se rompe
  // en cuanto alguien reescribe el mensaje.
  errorCode: z.enum(['not_found', 'not_owner', 'not_completed', 'internal']).optional(),
})

export type GetTestReviewResponse = z.infer<typeof getTestReviewResponseSchema>

// ============================================
// VALIDADORES
// ============================================

export function validateTestReviewRequest(data: unknown): GetTestReviewRequest {
  return getTestReviewRequestSchema.parse(data)
}

export function safeParseTestReviewRequest(data: unknown) {
  return getTestReviewRequestSchema.safeParse(data)
}
