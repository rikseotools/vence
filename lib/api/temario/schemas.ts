// lib/api/temario/schemas.ts - Schemas Zod para Temario Dinámico
import { z } from 'zod'
import { OPOSICIONES as ALL_OPOSICIONES } from '@/lib/config/oposiciones'

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
  // Conteo total de preguntas activas vinculadas a este artículo
  questionCount: z.number().default(0),
})

export const LawSchema = z.object({
  id: z.string().uuid(),
  shortName: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  year: z.number().nullable(),
  boeUrl: z.string().nullable(),
})

export const LawWithArticlesSchema = z.object({
  law: LawSchema,
  articles: z.array(ArticleSchema),
  articleCount: z.number(),
})

// Vídeo-curso asociado a un tema. Se deriva automáticamente cruzando las leyes
// del tema (topic_scope) con video_courses.law_id — NO mapping hardcodeado por
// oposición (ver migración 20260608_video_courses_law_id). Garantiza versión
// correcta: solo aparece el curso si la ley exacta (p.ej. "Windows 11") está en
// el temario de esa oposición.
export const VideoCourseSchema = z.object({
  slug: z.string(),
  title: z.string(),
  totalLessons: z.number(),
  totalDurationMinutes: z.number(),
  description: z.string().nullable(),
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

  // Vídeo-cursos derivados de las leyes del tema (vacío si ninguna ley tiene curso).
  videoCourses: z.array(VideoCourseSchema).default([]),

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
export type VideoCourse = z.infer<typeof VideoCourseSchema>
export type UnlockRequirements = z.infer<typeof UnlockRequirementsSchema>
export type UserProgress = z.infer<typeof UserProgressSchema>
export type TopicContent = z.infer<typeof TopicContentSchema>
export type TopicSummary = z.infer<typeof TopicSummarySchema>
export type TopicListResponse = z.infer<typeof TopicListResponseSchema>
export type TopicContentResponse = z.infer<typeof TopicContentResponseSchema>

// ============================================
// CONSTANTES
// ============================================

// Derivado de config central - mantiene misma estructura para compatibilidad
export const OPOSICIONES = Object.fromEntries(
  ALL_OPOSICIONES.map(o => [o.slug, {
    id: o.positionType,
    name: o.name,
    totalTopics: o.totalTopics,
    positionType: o.positionType,
  }])
) as Record<string, { id: string; name: string; totalTopics: number; positionType: string }>

export type OposicionSlug = keyof typeof OPOSICIONES
