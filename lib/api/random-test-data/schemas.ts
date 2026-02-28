// lib/api/random-test-data/schemas.ts - Schemas de validación para datos de test aleatorio
import { z } from 'zod'
import {
  OPOSICIONES,
  OPOSICION_SLUGS_ENUM,
  SLUG_TO_POSITION_TYPE,
} from '@/lib/config/oposiciones'

// ============================================
// REQUEST SCHEMAS
// ============================================

// Request para obtener datos iniciales del test aleatorio
export const getRandomTestDataRequestSchema = z.object({
  oposicion: z.enum(OPOSICION_SLUGS_ENUM),
  userId: z.string().uuid().nullable().optional(),
})

export type GetRandomTestDataRequest = z.infer<typeof getRandomTestDataRequestSchema>

// Request para verificar disponibilidad de preguntas con filtros
export const checkAvailableQuestionsRequestSchema = z.object({
  oposicion: z.enum(OPOSICION_SLUGS_ENUM),
  selectedThemes: z.array(z.number().int().positive()).min(1),
  difficulty: z.enum(['mixed', 'easy', 'medium', 'hard']).default('mixed'),
  onlyOfficialQuestions: z.boolean().default(false),
  focusEssentialArticles: z.boolean().default(false),
})

export type CheckAvailableQuestionsRequest = z.infer<typeof checkAvailableQuestionsRequestSchema>

// Request para estadísticas detalladas de un tema
export const getDetailedThemeStatsRequestSchema = z.object({
  oposicion: z.enum(OPOSICION_SLUGS_ENUM),
  themeId: z.number().int().positive(),
  userId: z.string().uuid(),
})

export type GetDetailedThemeStatsRequest = z.infer<typeof getDetailedThemeStatsRequestSchema>

// ============================================
// THEME QUESTION COUNT SCHEMAS
// ============================================

// Conteo de preguntas por tema
export const themeQuestionCountSchema = z.object({
  themeId: z.number().int().positive(),
  questionCount: z.number().int().nonnegative(),
})

export type ThemeQuestionCount = z.infer<typeof themeQuestionCountSchema>

// Mapa de conteos por tema
export const themeQuestionCountsSchema = z.record(
  z.string(), // themeId como string (keys de objetos son strings)
  z.number().int().nonnegative()
)

export type ThemeQuestionCounts = z.infer<typeof themeQuestionCountsSchema>

// ============================================
// USER THEME STATS SCHEMAS
// ============================================

// Estadísticas de un tema para el usuario
export const userThemeStatSchema = z.object({
  total: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(100),
  lastStudy: z.string().nullable(), // ISO date string
  lastStudyFormatted: z.string().optional(),
})

export type UserThemeStat = z.infer<typeof userThemeStatSchema>

// Mapa de estadísticas del usuario por tema
export const userThemeStatsSchema = z.record(
  z.string(), // themeId como string
  userThemeStatSchema
)

export type UserThemeStats = z.infer<typeof userThemeStatsSchema>

// ============================================
// DETAILED THEME STATS SCHEMAS
// ============================================

// Estadísticas detalladas de un tema (preguntas vistas/no vistas)
export const detailedThemeStatsSchema = z.object({
  themeId: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  answered: z.number().int().nonnegative(),
  neverSeen: z.number().int().nonnegative(),
})

export type DetailedThemeStats = z.infer<typeof detailedThemeStatsSchema>

// ============================================
// RESPONSE SCHEMAS
// ============================================

// Respuesta de datos iniciales del test aleatorio
export const getRandomTestDataResponseSchema = z.object({
  success: z.boolean(),
  // Conteo de preguntas por tema
  themeQuestionCounts: themeQuestionCountsSchema.optional(),
  // Estadísticas del usuario por tema (solo si userId proporcionado)
  userStats: userThemeStatsSchema.optional(),
  // Metadata
  error: z.string().optional(),
  cached: z.boolean().optional(),
  generatedAt: z.string().optional(),
})

export type GetRandomTestDataResponse = z.infer<typeof getRandomTestDataResponseSchema>

// Respuesta de verificación de disponibilidad
export const checkAvailableQuestionsResponseSchema = z.object({
  success: z.boolean(),
  availableQuestions: z.number().int().nonnegative().optional(),
  // Desglose por tema (opcional, para debugging)
  breakdown: z.record(z.string(), z.number().int().nonnegative()).optional(),
  error: z.string().optional(),
  cached: z.boolean().optional(),
})

export type CheckAvailableQuestionsResponse = z.infer<typeof checkAvailableQuestionsResponseSchema>

// Respuesta de estadísticas detalladas de tema
export const getDetailedThemeStatsResponseSchema = z.object({
  success: z.boolean(),
  stats: detailedThemeStatsSchema.optional(),
  error: z.string().optional(),
})

export type GetDetailedThemeStatsResponse = z.infer<typeof getDetailedThemeStatsResponseSchema>

// ============================================
// VALIDATORS
// ============================================

export function validateGetRandomTestDataRequest(data: unknown): GetRandomTestDataRequest {
  return getRandomTestDataRequestSchema.parse(data)
}

export function safeParseGetRandomTestDataRequest(data: unknown) {
  return getRandomTestDataRequestSchema.safeParse(data)
}

export function validateCheckAvailableQuestionsRequest(data: unknown): CheckAvailableQuestionsRequest {
  return checkAvailableQuestionsRequestSchema.parse(data)
}

export function safeParseCheckAvailableQuestionsRequest(data: unknown) {
  return checkAvailableQuestionsRequestSchema.safeParse(data)
}

export function validateGetDetailedThemeStatsRequest(data: unknown): GetDetailedThemeStatsRequest {
  return getDetailedThemeStatsRequestSchema.parse(data)
}

export function safeParseGetDetailedThemeStatsRequest(data: unknown) {
  return getDetailedThemeStatsRequestSchema.safeParse(data)
}

export function validateGetRandomTestDataResponse(data: unknown): GetRandomTestDataResponse {
  return getRandomTestDataResponseSchema.parse(data)
}

export function safeParseGetRandomTestDataResponse(data: unknown) {
  return getRandomTestDataResponseSchema.safeParse(data)
}

// ============================================
// HELPER TYPES
// ============================================

// Mapa de posición a position_type en BD (re-export desde config central)
export { SLUG_TO_POSITION_TYPE as OPOSICION_TO_POSITION_TYPE } from '@/lib/config/oposiciones'

export type OposicionKey = string

// Rangos válidos de temas por oposición para test aleatorio
// Generados automáticamente desde la config central
export const VALID_THEME_IDS: Record<string, { min: number; max: number }> = Object.fromEntries(
  OPOSICIONES.map(o => [o.slug, { min: 1, max: o.totalTopics }])
)

// Función para validar si un themeId es válido para una oposición
export function isValidThemeId(themeId: number, oposicion: string): boolean {
  const range = VALID_THEME_IDS[oposicion]
  if (!range) return false
  return themeId >= range.min && themeId <= range.max
}

// Mapeo de themeId secuencial (1..N) a topic_number en BD para TODAS las oposiciones
// Generado automáticamente desde la config central
export const THEME_TO_TOPIC: Record<string, Record<number, number>> = Object.fromEntries(
  OPOSICIONES.map(o => {
    const mapping: Record<number, number> = {}
    let seq = 1
    for (const block of o.blocks) {
      for (const theme of block.themes) {
        mapping[seq] = theme.id
        seq++
      }
    }
    return [o.slug, mapping]
  })
)

// Función para convertir themeId interno a topic_number de BD
export function getTopicNumberFromThemeId(themeId: number, oposicion: string): number {
  return THEME_TO_TOPIC[oposicion]?.[themeId] ?? themeId
}

// Función inversa: de topic_number a themeId interno
export function getThemeIdFromTopicNumber(topicNumber: number, oposicion: string): number {
  const mapping = THEME_TO_TOPIC[oposicion]
  if (mapping) {
    const entry = Object.entries(mapping).find(([, tn]) => tn === topicNumber)
    if (entry) return parseInt(entry[0])
  }
  return topicNumber
}
