// lib/api/filtered-questions/schemas.ts - Schemas de validación para preguntas filtradas
import { z } from 'zod'

// ============================================
// SCHEMAS PARA FILTROS DE SECCIONES/TÍTULOS
// ============================================

export const sectionFilterSchema = z.object({
  title: z.string(),
  articleRange: z.object({
    start: z.number().int().min(1),
    end: z.number().int().min(1),
  }).optional(),
  sectionNumber: z.string().optional(),
  sectionType: z.string().optional(),
})

export type SectionFilter = z.infer<typeof sectionFilterSchema>

// ============================================
// SCHEMA PRINCIPAL DE REQUEST
// ============================================

export const getFilteredQuestionsRequestSchema = z.object({
  // Tema y tipo de oposición (topicNumber=0 significa sin filtro de tema)
  topicNumber: z.number().int().min(0),
  positionType: z.enum(['administrativo_estado', 'auxiliar_administrativo', 'administrativo']),

  // 🆕 Múltiples temas (para test aleatorio multi-tema)
  multipleTopics: z.array(z.number().int().min(1)).default([]),

  // Cantidad de preguntas
  numQuestions: z.number().int().min(1).max(100).default(25),

  // Filtros de leyes (array de short_names)
  selectedLaws: z.array(z.string()).default([]),

  // Filtros de artículos por ley: { "CE": [1, 2, 3], "Ley 39/2015": [5, 10] }
  selectedArticlesByLaw: z.record(z.string(), z.array(z.number().int())).default({}),

  // Filtros de secciones/títulos
  selectedSectionFilters: z.array(sectionFilterSchema).default([]),

  // Solo preguntas oficiales
  onlyOfficialQuestions: z.boolean().default(false),

  // Modo de dificultad
  difficultyMode: z.enum(['random', 'easy', 'medium', 'hard', 'adaptive']).default('random'),

  // 🆕 Excluir preguntas recientes del usuario
  excludeRecentDays: z.number().int().min(0).max(365).default(0),
  userId: z.string().uuid().optional(),

  // 🆕 Filtros avanzados
  focusEssentialArticles: z.boolean().default(false),  // Solo artículos con preguntas oficiales
  prioritizeNeverSeen: z.boolean().default(false),     // Priorizar preguntas nunca vistas
  proportionalByTopic: z.boolean().default(false),     // Distribución proporcional entre temas
})

export type GetFilteredQuestionsRequest = z.infer<typeof getFilteredQuestionsRequestSchema>

// ============================================
// SCHEMA DE ARTÍCULO EN RESPUESTA
// ============================================

export const articleResponseSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  title: z.string().nullable(),
  full_text: z.string().nullable(),
  law_name: z.string(),
  law_short_name: z.string(),
  display_number: z.string(),
})

export type ArticleResponse = z.infer<typeof articleResponseSchema>

// ============================================
// SCHEMA DE METADATA DE PREGUNTA
// ============================================

export const questionMetadataSchema = z.object({
  id: z.string().uuid(),
  difficulty: z.string(),
  question_type: z.string(),
  tags: z.array(z.string()).nullable(),
  is_active: z.boolean(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  is_official_exam: z.boolean().nullable(),
  exam_source: z.string().nullable(),
  exam_date: z.string().nullable(),
  exam_entity: z.string().nullable(),
  official_difficulty_level: z.string().nullable(),
})

export type QuestionMetadata = z.infer<typeof questionMetadataSchema>

// ============================================
// SCHEMA DE PREGUNTA COMPLETA (RESPONSE)
// ============================================

export const filteredQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  explanation: z.string(),
  primary_article_id: z.string().uuid(),
  tema: z.number().nullable(),
  article: articleResponseSchema,
  metadata: questionMetadataSchema,
})

export type FilteredQuestion = z.infer<typeof filteredQuestionSchema>

// ============================================
// SCHEMA DE RESPONSE COMPLETO
// ============================================

export const getFilteredQuestionsResponseSchema = z.object({
  success: z.boolean(),
  questions: z.array(filteredQuestionSchema).optional(),
  totalAvailable: z.number().int().optional(),
  filtersApplied: z.object({
    laws: z.number().int(),
    articles: z.number().int(),
    sections: z.number().int(),
  }).optional(),
  error: z.string().optional(),
})

export type GetFilteredQuestionsResponse = z.infer<typeof getFilteredQuestionsResponseSchema>

// ============================================
// VALIDADORES HELPER
// ============================================

export function validateGetFilteredQuestions(data: unknown): GetFilteredQuestionsRequest {
  return getFilteredQuestionsRequestSchema.parse(data)
}

export function safeParseGetFilteredQuestions(data: unknown) {
  return getFilteredQuestionsRequestSchema.safeParse(data)
}

// ============================================
// SCHEMA PARA CONTAR PREGUNTAS DISPONIBLES
// ============================================

export const countFilteredQuestionsRequestSchema = z.object({
  topicNumber: z.number().int().min(1),
  positionType: z.enum(['administrativo_estado', 'auxiliar_administrativo', 'administrativo']),
  selectedLaws: z.array(z.string()).default([]),
  selectedArticlesByLaw: z.record(z.string(), z.array(z.number().int())).default({}),
  selectedSectionFilters: z.array(sectionFilterSchema).default([]),
  onlyOfficialQuestions: z.boolean().default(false),
})

export type CountFilteredQuestionsRequest = z.infer<typeof countFilteredQuestionsRequestSchema>

export const countFilteredQuestionsResponseSchema = z.object({
  success: z.boolean(),
  count: z.number().int().optional(),
  byLaw: z.record(z.string(), z.number().int()).optional(),
  error: z.string().optional(),
})

export type CountFilteredQuestionsResponse = z.infer<typeof countFilteredQuestionsResponseSchema>

export function safeParseCountFilteredQuestions(data: unknown) {
  return countFilteredQuestionsRequestSchema.safeParse(data)
}
