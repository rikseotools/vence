// lib/api/temario/schemas.ts - Schemas Zod para Temario Dinámico
import { z } from 'zod'

// ============================================
// SCHEMAS BASE
// ============================================

export const ArticleSchema = z.object({
  id: z.string().uuid(),
  articleNumber: z.string(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  titleNumber: z.string().nullable(),
  chapterNumber: z.string().nullable(),
  section: z.string().nullable(),
  // Conteo de preguntas de exámenes oficiales vinculadas a este artículo
  officialQuestionCount: z.number().default(0),
})

export const LawSchema = z.object({
  id: z.string().uuid(),
  shortName: z.string(),
  name: z.string(),
  year: z.number().nullable(),
  boeUrl: z.string().nullable(),
})

export const LawWithArticlesSchema = z.object({
  law: LawSchema,
  articles: z.array(ArticleSchema),
  articleCount: z.number(),
})

// ============================================
// SCHEMAS DE PROGRESO Y DESBLOQUEO
// ============================================

export const UnlockRequirementsSchema = z.object({
  requiredAccuracy: z.number().default(70),
  requiredQuestions: z.number().default(10),
  currentAccuracy: z.number(),
  currentQuestions: z.number(),
  previousTopicNumber: z.number().nullable(),
  previousTopicAccuracy: z.number().nullable(),
})

export const UserProgressSchema = z.object({
  questionsAnswered: z.number(),
  correctAnswers: z.number(),
  accuracy: z.number(),
  masteryLevel: z.enum(['beginner', 'good', 'expert']).nullable(),
  lastPracticed: z.string().nullable(),
})

// ============================================
// SCHEMA PRINCIPAL: CONTENIDO DEL TEMA
// ============================================

export const TopicContentSchema = z.object({
  // Metadatos del tema
  topicNumber: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  oposicion: z.string(),
  oposicionName: z.string(),

  // Estado de acceso
  isUnlocked: z.boolean(),
  unlockRequirements: UnlockRequirementsSchema.nullable(),

  // Contenido: leyes con sus artículos
  laws: z.array(LawWithArticlesSchema),
  totalArticles: z.number(),

  // Progreso del usuario (null si no autenticado)
  userProgress: UserProgressSchema.nullable(),

  // Metadata
  lastUpdated: z.string().nullable(),
  generatedAt: z.string(),
})

// ============================================
// SCHEMA: LISTA DE TEMAS
// ============================================

export const TopicSummarySchema = z.object({
  topicNumber: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  isUnlocked: z.boolean(),
  userProgress: z.number().nullable(), // % de precisión
  articlesCount: z.number(),
  lawsCount: z.number(),
})

export const TopicListResponseSchema = z.object({
  success: z.boolean(),
  oposicion: z.string(),
  oposicionName: z.string(),
  totalTopics: z.number(),
  topics: z.array(TopicSummarySchema),
})

// ============================================
// SCHEMA: RESPUESTA API
// ============================================

export const TopicContentResponseSchema = z.object({
  success: z.boolean(),
  data: TopicContentSchema.optional(),
  error: z.string().optional(),
})

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type Article = z.infer<typeof ArticleSchema>
export type Law = z.infer<typeof LawSchema>
export type LawWithArticles = z.infer<typeof LawWithArticlesSchema>
export type UnlockRequirements = z.infer<typeof UnlockRequirementsSchema>
export type UserProgress = z.infer<typeof UserProgressSchema>
export type TopicContent = z.infer<typeof TopicContentSchema>
export type TopicSummary = z.infer<typeof TopicSummarySchema>
export type TopicListResponse = z.infer<typeof TopicListResponseSchema>
export type TopicContentResponse = z.infer<typeof TopicContentResponseSchema>

// ============================================
// CONSTANTES
// ============================================

export const OPOSICIONES = {
  'auxiliar-administrativo-estado': {
    id: 'auxiliar_administrativo',
    name: 'Auxiliar Administrativo del Estado',
    totalTopics: 28,
    positionType: 'auxiliar_administrativo',
  },
  'administrativo-estado': {
    id: 'administrativo',
    name: 'Administrativo del Estado (C1)',
    totalTopics: 45,
    positionType: 'administrativo',
  },
} as const

export type OposicionSlug = keyof typeof OPOSICIONES
