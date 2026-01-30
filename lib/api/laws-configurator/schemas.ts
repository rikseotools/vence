// lib/api/laws-configurator/schemas.ts - Schemas para configurador de leyes
import { z } from 'zod'

// ============================================
// REQUEST: GET ALL LAWS WITH STATS
// ============================================

export const getAllLawsRequestSchema = z.object({
  // Opcional: filtrar por positionType
  positionType: z.string().optional(),
  // Opcional: incluir leyes sin preguntas
  includeEmpty: z.boolean().default(false),
})

export type GetAllLawsRequest = z.infer<typeof getAllLawsRequestSchema>

// ============================================
// DATA SCHEMAS
// ============================================

export const lawDataSchema = z.object({
  lawShortName: z.string(),
  lawName: z.string(),
  totalQuestions: z.number().int().min(0),
  articlesWithQuestions: z.number().int().min(0),
})

export type LawData = z.infer<typeof lawDataSchema>

// ============================================
// RESPONSE: GET ALL LAWS
// ============================================

export const getAllLawsResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(lawDataSchema).optional(),
  totalLaws: z.number().optional(),
  totalQuestions: z.number().optional(),
  error: z.string().optional(),
})

export type GetAllLawsResponse = z.infer<typeof getAllLawsResponseSchema>

// ============================================
// RESPONSE: ERROR
// ============================================

export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
})

export type ErrorResponse = z.infer<typeof errorResponseSchema>

// ============================================
// VALIDATORS
// ============================================

export function safeParseGetAllLaws(data: unknown) {
  return getAllLawsRequestSchema.safeParse(data)
}
