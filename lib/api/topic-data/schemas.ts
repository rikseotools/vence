// lib/api/topic-data/schemas.ts - Schemas de validación para datos de tema
import { z } from 'zod'

// ============================================
// REQUEST SCHEMAS
// ============================================

export const getTopicDataRequestSchema = z.object({
  topicNumber: z.number().int().positive('Número de tema debe ser positivo'),
  oposicion: z.enum(['auxiliar-administrativo-estado', 'administrativo-estado', 'tramitacion-procesal', 'auxilio-judicial']),
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

// Mapa de posición a position_type en BD
export const OPOSICION_TO_POSITION_TYPE = {
  'auxiliar-administrativo-estado': 'auxiliar_administrativo',
  'administrativo-estado': 'administrativo',
  'tramitacion-procesal': 'tramitacion_procesal',
  'auxilio-judicial': 'auxilio_judicial',
} as const

export type OposicionKey = keyof typeof OPOSICION_TO_POSITION_TYPE

// Rangos válidos de temas por oposición
export const VALID_TOPIC_RANGES = {
  'auxiliar-administrativo-estado': {
    bloque1: { min: 1, max: 16 },
    bloque2: { min: 101, max: 112 },
  },
  'administrativo-estado': {
    bloque1: { min: 1, max: 11 },
    bloque2: { min: 201, max: 204 },
    bloque3: { min: 301, max: 307 },
    bloque4: { min: 401, max: 409 },
    bloque5: { min: 501, max: 506 },
    bloque6: { min: 601, max: 608 },
  },
  'tramitacion-procesal': {
    bloque1: { min: 1, max: 15 },   // Organización del Estado y Administración de Justicia
    bloque2: { min: 16, max: 31 },  // Derecho Procesal
    bloque3: { min: 32, max: 37 },  // Informática
  },
  'auxilio-judicial': {
    bloque1: { min: 1, max: 5 },    // Derecho Constitucional y Organización del Estado
    bloque2: { min: 6, max: 15 },   // Organización Judicial y Funcionarios
    bloque3: { min: 16, max: 26 },  // Procedimientos y Actos Procesales
  },
} as const

// Función para validar si un tema es válido para una oposición
export function isValidTopicNumber(topicNumber: number, oposicion: OposicionKey): boolean {
  const ranges = VALID_TOPIC_RANGES[oposicion]

  for (const range of Object.values(ranges)) {
    if (topicNumber >= range.min && topicNumber <= range.max) {
      return true
    }
  }

  return false
}
