// lib/api/tema-resolver/schemas.ts - Schemas Zod para resolución de tema
import { z } from 'zod'

// Tipos de oposición válidos
export const OposicionIdSchema = z.enum([
  'auxiliar_administrativo_estado',
  'administrativo_estado',
  'tramitacion_procesal',
  'auxilio_judicial',
])

export type OposicionId = z.infer<typeof OposicionIdSchema>

// Tipos de position_type en la BD (tabla topics)
export const PositionTypeSchema = z.enum([
  'auxiliar_administrativo',
  'administrativo',
  'tramitacion_procesal',
  'auxilio_judicial',
])

export type PositionType = z.infer<typeof PositionTypeSchema>

// Mapa de conversión oposicion_id -> position_type
export const OPOSICION_TO_POSITION_TYPE: Record<OposicionId, PositionType> = {
  'auxiliar_administrativo_estado': 'auxiliar_administrativo',
  'administrativo_estado': 'administrativo',
  'tramitacion_procesal': 'tramitacion_procesal',
  'auxilio_judicial': 'auxilio_judicial',
}

// Schema para request de resolución de tema por artículo
export const ResolveTemaByArticleRequestSchema = z.object({
  // Al menos uno de estos debe estar presente
  questionId: z.string().uuid().optional().nullable(),
  articleId: z.string().uuid().optional().nullable(),
  articleNumber: z.string().optional().nullable(),
  lawId: z.string().uuid().optional().nullable(),
  lawShortName: z.string().optional().nullable(),
  // Oposición del usuario (requerida para determinar el tema correcto)
  oposicionId: OposicionIdSchema.optional().default('auxiliar_administrativo_estado'),
}).refine(
  (data) => data.questionId || data.articleId || (data.articleNumber && (data.lawId || data.lawShortName)),
  {
    message: 'Debe proporcionar questionId, articleId, o (articleNumber + lawId/lawShortName)',
  }
)

export type ResolveTemaByArticleRequest = z.infer<typeof ResolveTemaByArticleRequestSchema>

// Schema para respuesta exitosa
export const ResolveTemaSuccessSchema = z.object({
  success: z.literal(true),
  temaNumber: z.number().int().positive(),
  topicId: z.string().uuid(),
  topicTitle: z.string().optional(),
  positionType: PositionTypeSchema,
  // Datos adicionales para debugging/logging
  resolvedVia: z.enum(['question', 'article', 'article_number', 'full_law']),
  cached: z.boolean().optional(),
})

export type ResolveTemaSuccess = z.infer<typeof ResolveTemaSuccessSchema>

// Schema para respuesta de error (tema no encontrado)
export const ResolveTemaNotFoundSchema = z.object({
  success: z.literal(false),
  temaNumber: z.null(),
  error: z.string().optional(),
  reason: z.enum([
    'question_not_found',
    'article_not_found',
    'law_not_found',
    'no_topic_scope_match',
    'invalid_position_type',
    'missing_required_params',
  ]).optional(),
})

export type ResolveTemaNotFound = z.infer<typeof ResolveTemaNotFoundSchema>

// Schema unión para respuesta
export const ResolveTemaResponseSchema = z.discriminatedUnion('success', [
  ResolveTemaSuccessSchema,
  ResolveTemaNotFoundSchema,
])

export type ResolveTemaResponse = z.infer<typeof ResolveTemaResponseSchema>

// Schema para batch request (múltiples preguntas)
export const ResolveTemasBatchRequestSchema = z.object({
  questions: z.array(z.object({
    questionId: z.string().uuid().optional().nullable(),
    articleId: z.string().uuid().optional().nullable(),
    articleNumber: z.string().optional().nullable(),
    lawId: z.string().uuid().optional().nullable(),
  })).min(1).max(100),
  oposicionId: OposicionIdSchema.optional().default('auxiliar_administrativo_estado'),
})

export type ResolveTemasBatchRequest = z.infer<typeof ResolveTemasBatchRequestSchema>

// Schema para batch response
export const ResolveTemasBatchResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(z.object({
    index: z.number(),
    temaNumber: z.number().nullable(),
    topicId: z.string().uuid().nullable(),
  })),
  resolved: z.number(),
  notFound: z.number(),
  cached: z.boolean().optional(),
})

export type ResolveTemasBatchResponse = z.infer<typeof ResolveTemasBatchResponseSchema>

// Helper para validar request
export function safeParseResolveTemaRequest(data: unknown) {
  return ResolveTemaByArticleRequestSchema.safeParse(data)
}

export function safeParseResolveTemasBatchRequest(data: unknown) {
  return ResolveTemasBatchRequestSchema.safeParse(data)
}
