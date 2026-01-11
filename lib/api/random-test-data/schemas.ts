// lib/api/random-test-data/schemas.ts - Schemas de validación para datos de test aleatorio
import { z } from 'zod'

// ============================================
// REQUEST SCHEMAS
// ============================================

// Request para obtener datos iniciales del test aleatorio
export const getRandomTestDataRequestSchema = z.object({
  oposicion: z.enum(['auxiliar-administrativo-estado', 'administrativo-estado']),
  userId: z.string().uuid().nullable().optional(),
})

export type GetRandomTestDataRequest = z.infer<typeof getRandomTestDataRequestSchema>

// Request para verificar disponibilidad de preguntas con filtros
export const checkAvailableQuestionsRequestSchema = z.object({
  oposicion: z.enum(['auxiliar-administrativo-estado', 'administrativo-estado']),
  selectedThemes: z.array(z.number().int().positive()).min(1),
  difficulty: z.enum(['mixed', 'easy', 'medium', 'hard']).default('mixed'),
  onlyOfficialQuestions: z.boolean().default(false),
  focusEssentialArticles: z.boolean().default(false),
})

export type CheckAvailableQuestionsRequest = z.infer<typeof checkAvailableQuestionsRequestSchema>

// Request para estadísticas detalladas de un tema
export const getDetailedThemeStatsRequestSchema = z.object({
  oposicion: z.enum(['auxiliar-administrativo-estado', 'administrativo-estado']),
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

// Mapa de posición a position_type en BD
export const OPOSICION_TO_POSITION_TYPE = {
  'auxiliar-administrativo-estado': 'auxiliar_administrativo',
  'administrativo-estado': 'administrativo',
} as const

export type OposicionKey = keyof typeof OPOSICION_TO_POSITION_TYPE

// Rangos válidos de temas por oposición para test aleatorio
// Estos son los IDs internos usados en la página de test aleatorio
export const VALID_THEME_IDS = {
  'auxiliar-administrativo-estado': {
    // Bloque I: 1-16, Bloque II: 17-28 (mapeados desde 101-112)
    min: 1,
    max: 28,
  },
  'administrativo-estado': {
    // 45 temas totales (1-45)
    min: 1,
    max: 45,
  },
} as const

// Función para validar si un themeId es válido para una oposición
export function isValidThemeId(themeId: number, oposicion: OposicionKey): boolean {
  const range = VALID_THEME_IDS[oposicion]
  return themeId >= range.min && themeId <= range.max
}

// Mapeo de themeId interno a topic_number en BD para administrativo
export const ADMINISTRATIVO_THEME_TO_TOPIC: Record<number, number> = {
  // Bloque I (1-11)
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11,
  // Bloque II (12-15) -> topic_number 201-204
  12: 201, 13: 202, 14: 203, 15: 204,
  // Bloque III (16-22) -> topic_number 301-307
  16: 301, 17: 302, 18: 303, 19: 304, 20: 305, 21: 306, 22: 307,
  // Bloque IV (23-31) -> topic_number 401-409
  23: 401, 24: 402, 25: 403, 26: 404, 27: 405, 28: 406, 29: 407, 30: 408, 31: 409,
  // Bloque V (32-37) -> topic_number 501-506
  32: 501, 33: 502, 34: 503, 35: 504, 36: 505, 37: 506,
  // Bloque VI (38-45) -> topic_number 601-608
  38: 601, 39: 602, 40: 603, 41: 604, 42: 605, 43: 606, 44: 607, 45: 608,
}

// Función para convertir themeId interno a topic_number de BD
export function getTopicNumberFromThemeId(themeId: number, oposicion: OposicionKey): number {
  if (oposicion === 'administrativo-estado') {
    return ADMINISTRATIVO_THEME_TO_TOPIC[themeId] || themeId
  }
  // Para auxiliar, el themeId es el mismo que topic_number
  // Excepto Bloque II donde 17-28 mapean a 101-112
  if (themeId >= 17 && themeId <= 28) {
    return 100 + (themeId - 16) // 17->101, 18->102, etc.
  }
  return themeId
}

// Función inversa: de topic_number a themeId interno
export function getThemeIdFromTopicNumber(topicNumber: number, oposicion: OposicionKey): number {
  if (oposicion === 'administrativo-estado') {
    // Buscar en el mapeo inverso
    const entry = Object.entries(ADMINISTRATIVO_THEME_TO_TOPIC).find(([, tn]) => tn === topicNumber)
    return entry ? parseInt(entry[0]) : topicNumber
  }
  // Para auxiliar
  if (topicNumber >= 101 && topicNumber <= 112) {
    return 16 + (topicNumber - 100) // 101->17, 102->18, etc.
  }
  return topicNumber
}
