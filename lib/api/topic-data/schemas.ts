// lib/api/topic-data/schemas.ts - Schemas de validación para datos de tema
import { z } from 'zod'
import {
  OPOSICIONES,
  OPOSICION_SLUGS_ENUM,
  SLUG_TO_POSITION_TYPE,
} from '@/lib/config/oposiciones'

// ============================================
// REQUEST SCHEMAS
// ============================================

export const getTopicDataRequestSchema = z.object({
  topicNumber: z.number().int().positive('Número de tema debe ser positivo'),
  oposicion: z.enum(OPOSICION_SLUGS_ENUM),
  userId: z.string().uuid().nullable().optional(),
})

export type GetTopicDataRequest = z.infer<typeof getTopicDataRequestSchema>

// ============================================
// TOPIC INFO SCHEMAS
// ============================================

// Datos básicos del tema
export const topicInfoSchema = z.object({
  id: z.string().uuid(),
  topicNumber: z.number().int(),
  title: z.string().min(1),
  description: z.string().nullable(),
  difficulty: z.string().nullable(),
  estimatedHours: z.number().nullable(),
})

export type TopicInfo = z.infer<typeof topicInfoSchema>

// ============================================
// DIFFICULTY STATS SCHEMAS
// ============================================

// Estadísticas por dificultad
export const difficultyStatsSchema = z.object({
  easy: z.number().int().nonnegative().default(0),
  medium: z.number().int().nonnegative().default(0),
  hard: z.number().int().nonnegative().default(0),
  extreme: z.number().int().nonnegative().default(0),
  auto: z.number().int().nonnegative().default(0),
})

export type DifficultyStats = z.infer<typeof difficultyStatsSchema>

// ============================================
// ARTICLES BY LAW SCHEMAS
// ============================================

// Conteo de artículos por ley
export const articlesByLawItemSchema = z.object({
  lawShortName: z.string(),
  lawName: z.string(),
  articlesWithQuestions: z.number().int().nonnegative(),
})

export type ArticlesByLawItem = z.infer<typeof articlesByLawItemSchema>

export const articlesByLawSchema = z.array(articlesByLawItemSchema)

export type ArticlesByLaw = z.infer<typeof articlesByLawSchema>

// ============================================
// USER PROGRESS SCHEMAS
// ============================================

// Estadísticas de rendimiento por dificultad del usuario
export const userPerformanceByDifficultySchema = z.record(
  z.string(),
  z.object({
    total: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(100),
  })
)

export type UserPerformanceByDifficulty = z.infer<typeof userPerformanceByDifficultySchema>

// Progreso del usuario en el tema
export const userProgressSchema = z.object({
  totalAnswers: z.number().int().nonnegative(),
  overallAccuracy: z.number().min(0).max(100),
  uniqueQuestionsAnswered: z.number().int().nonnegative(),
  totalQuestionsAvailable: z.number().int().nonnegative(),
  neverSeen: z.number().int().nonnegative(),
  performanceByDifficulty: userPerformanceByDifficultySchema,
  // Estadísticas recientes
  recentStats: z.object({
    last7Days: z.number().int().nonnegative(),
    last15Days: z.number().int().nonnegative(),
    last30Days: z.number().int().nonnegative(),
  }).optional(),
  // Respuestas detalladas para métricas del cliente
  detailedAnswers: z.array(z.object({
    questionId: z.string(),
    isCorrect: z.boolean(),
    createdAt: z.string(),
    timeSpentSeconds: z.number().nullable(),
    articleNumber: z.string(),
    difficulty: z.string().nullable(),
    confidenceLevel: z.string().nullable(),
    lawName: z.string().nullable(),
  })).optional(),
})

export type UserProgress = z.infer<typeof userProgressSchema>

// ============================================
// FULL RESPONSE SCHEMA
// ============================================

// Respuesta completa de la API
export const getTopicDataResponseSchema = z.object({
  success: z.boolean(),
  // Datos del tema
  topic: topicInfoSchema.optional(),
  // Estadísticas de preguntas
  difficultyStats: difficultyStatsSchema.optional(),
  totalQuestions: z.number().int().nonnegative().optional(),
  officialQuestionsCount: z.number().int().nonnegative().optional(),
  // Artículos por ley
  articlesByLaw: articlesByLawSchema.optional(),
  // Progreso del usuario (solo si userId proporcionado)
  userProgress: userProgressSchema.nullable().optional(),
  // Metadata
  error: z.string().optional(),
  cached: z.boolean().optional(),
  generatedAt: z.string().optional(),
})

export type GetTopicDataResponse = z.infer<typeof getTopicDataResponseSchema>

// ============================================
// VALIDATORS
// ============================================

export function validateGetTopicDataRequest(data: unknown): GetTopicDataRequest {
  return getTopicDataRequestSchema.parse(data)
}

export function safeParseGetTopicDataRequest(data: unknown) {
  return getTopicDataRequestSchema.safeParse(data)
}

export function validateGetTopicDataResponse(data: unknown): GetTopicDataResponse {
  return getTopicDataResponseSchema.parse(data)
}

export function safeParseGetTopicDataResponse(data: unknown) {
  return getTopicDataResponseSchema.safeParse(data)
}

// ============================================
// HELPER TYPES
// ============================================

// Mapa de posición a position_type en BD (re-export desde config central)
export { SLUG_TO_POSITION_TYPE as OPOSICION_TO_POSITION_TYPE } from '@/lib/config/oposiciones'

// Rangos válidos de temas por oposición - derivados automáticamente de la config central
// Esto garantiza que al añadir una oposición en lib/config/oposiciones.ts,
// los rangos se actualizan sin necesidad de tocar este archivo.
function buildTopicRanges(): Record<string, Record<string, { min: number; max: number }>> {
  const ranges: Record<string, Record<string, { min: number; max: number }>> = {}
  for (const opo of OPOSICIONES) {
    const bloques: Record<string, { min: number; max: number }> = {}
    for (const block of opo.blocks) {
      const ids = block.themes.map(t => t.id)
      if (ids.length > 0) {
        bloques[block.id] = { min: Math.min(...ids), max: Math.max(...ids) }
      }
    }
    ranges[opo.slug] = bloques
  }
  return ranges
}

export const VALID_TOPIC_RANGES = buildTopicRanges()

// Set de IDs válidos por oposición (más preciso que rangos min/max)
const VALID_TOPIC_IDS = new Map<string, Set<number>>()
for (const opo of OPOSICIONES) {
  const ids = new Set<number>()
  for (const block of opo.blocks) {
    for (const theme of block.themes) {
      ids.add(theme.id)
    }
  }
  VALID_TOPIC_IDS.set(opo.slug, ids)
}

export type OposicionKey = string

// Función para validar si un tema es válido para una oposición
export function isValidTopicNumber(topicNumber: number, oposicion: OposicionKey): boolean {
  const validIds = VALID_TOPIC_IDS.get(oposicion)
  if (!validIds) return false
  return validIds.has(topicNumber)
}
