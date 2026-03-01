// lib/api/psychometric-test-data/schemas.ts
// Schemas Zod para la API de datos de test psicotécnico
// Categorías + secciones + conteos y carga de preguntas

import { z } from 'zod/v3'

// ============================================
// SECTION SCHEMA (subcategoría dentro de una categoría)
// ============================================

export const psychometricSectionSchema = z.object({
  key: z.string(),
  name: z.string(),
  count: z.number().int().nonnegative(),
})

export type PsychometricSection = z.infer<typeof psychometricSectionSchema>

// ============================================
// CATEGORY SCHEMA (categoría principal)
// ============================================

export const psychometricCategorySchema = z.object({
  key: z.string(),
  name: z.string(),
  questionCount: z.number().int().nonnegative(),
  sections: z.array(psychometricSectionSchema),
})

export type PsychometricCategory = z.infer<typeof psychometricCategorySchema>

// ============================================
// CATEGORIES RESPONSE (GET /api/psychometric-test-data)
// ============================================

export const getPsychometricCategoriesResponseSchema = z.object({
  success: z.boolean(),
  categories: z.array(psychometricCategorySchema).optional(),
  error: z.string().optional(),
})

export type GetPsychometricCategoriesResponse = z.infer<typeof getPsychometricCategoriesResponseSchema>

// ============================================
// QUESTIONS REQUEST (GET /api/psychometric-test-data/questions)
// ============================================

export const getPsychometricQuestionsRequestSchema = z.object({
  categories: z.array(z.string().min(1)).min(1, 'Selecciona al menos una categoría'),
  numQuestions: z.number().int().min(1).max(200).default(25),
})

export type GetPsychometricQuestionsRequest = z.infer<typeof getPsychometricQuestionsRequestSchema>

// ============================================
// QUESTION SCHEMA (pregunta SIN correct_option)
// ============================================

export const psychometricQuestionSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  sectionId: z.string().uuid().nullable(),
  questionSubtype: z.string(),
  questionText: z.string(),
  optionA: z.string().nullable(),
  optionB: z.string().nullable(),
  optionC: z.string().nullable(),
  optionD: z.string().nullable(),
  // correctOption: OMITIDO intencionalmente (seguridad anti-scraping)
  contentData: z.any(),
  difficulty: z.string().nullable(),
  timeLimitSeconds: z.number().nullable(),
  cognitiveSkills: z.array(z.string()).nullable(),
  isOfficialExam: z.boolean().nullable(),
  examSource: z.string().nullable(),
})

export type PsychometricQuestion = z.infer<typeof psychometricQuestionSchema>

// ============================================
// QUESTIONS RESPONSE (GET /api/psychometric-test-data/questions)
// ============================================

export const getPsychometricQuestionsResponseSchema = z.object({
  success: z.boolean(),
  questions: z.array(psychometricQuestionSchema).optional(),
  totalAvailable: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
})

export type GetPsychometricQuestionsResponse = z.infer<typeof getPsychometricQuestionsResponseSchema>

// ============================================
// VALIDATORS
// ============================================

export function safeParseGetPsychometricQuestionsRequest(data: unknown) {
  return getPsychometricQuestionsRequestSchema.safeParse(data)
}
