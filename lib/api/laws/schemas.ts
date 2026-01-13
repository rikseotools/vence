// lib/api/laws/schemas.ts - Schemas Zod para Leyes
import { z } from 'zod'

// ============================================
// SCHEMAS BASE
// ============================================

export const LawWithCountsSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  short_name: z.string(),
  description: z.string().nullable(),
  year: z.number().nullable(),
  type: z.string(),
  questionCount: z.number(),
  officialQuestions: z.number(),
})

// ============================================
// SCHEMAS DE RESPUESTA
// ============================================

export const GetLawsWithCountsResponseSchema = z.object({
  success: z.boolean(),
  laws: z.array(LawWithCountsSchema).optional(),
  error: z.string().optional(),
})

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type LawWithCounts = z.infer<typeof LawWithCountsSchema>
export type GetLawsWithCountsResponse = z.infer<typeof GetLawsWithCountsResponseSchema>
