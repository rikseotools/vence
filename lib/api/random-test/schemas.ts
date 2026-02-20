// lib/api/random-test/schemas.ts - Schemas Zod para Test Aleatorio
import { z } from 'zod'
import { OPOSICIONES, SLUG_TO_POSITION_TYPE } from '@/lib/config/oposiciones'

// ============================================
// CONSTANTES Y TIPOS BASE (derivados de config central)
// ============================================

export const OPOSICION_SLUGS = OPOSICIONES.map(o => o.slug) as [string, ...string[]]

export type OposicionSlug = (typeof OPOSICION_SLUGS)[number]

export const POSITION_TYPE_MAP: Record<string, string> = SLUG_TO_POSITION_TYPE

export const DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'extreme', 'mixed'] as const
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number]

export const TEST_MODES = ['practica', 'examen'] as const
export type TestMode = (typeof TEST_MODES)[number]

// ============================================
// SCHEMAS DE CONFIGURACIÓN DE BLOQUES
// ============================================

export const ThemeSchema = z.object({
  id: z.number(),
  name: z.string(),
  questionCount: z.number().default(0),
})

export const ThemeBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  icon: z.string(),
  themes: z.array(ThemeSchema),
})

export const OposicionConfigSchema = z.object({
  slug: z.string(),
  name: z.string(),
  shortName: z.string(),
  badge: z.string(),
  icon: z.string(),
  positionType: z.string(),
  blocks: z.array(ThemeBlockSchema),
  totalThemes: z.number(),
})

// ============================================
// REQUEST SCHEMAS
// ============================================

export const GetConfigRequestSchema = z.object({
  oposicion: z.enum(OPOSICION_SLUGS),
})

export const CheckAvailabilityRequestSchema = z.object({
  oposicion: z.enum(OPOSICION_SLUGS),
  selectedThemes: z.array(z.number()).min(1, 'Selecciona al menos un tema'),
  difficulty: z.enum(DIFFICULTY_LEVELS).default('mixed'),
  onlyOfficialQuestions: z.boolean().default(false),
  focusEssentialArticles: z.boolean().default(false),
  userId: z.string().uuid().nullable().optional(),
})

export const GenerateTestRequestSchema = z.object({
  oposicion: z.enum(OPOSICION_SLUGS),
  selectedThemes: z.array(z.number()).min(1, 'Selecciona al menos un tema'),
  numQuestions: z.number().min(5).max(100).default(25),
  difficulty: z.enum(DIFFICULTY_LEVELS).default('mixed'),
  onlyOfficialQuestions: z.boolean().default(false),
  focusEssentialArticles: z.boolean().default(false),
  adaptiveMode: z.boolean().default(false),
  testMode: z.enum(TEST_MODES).default('practica'),
  userId: z.string().uuid().nullable().optional(),
  excludeRecentDays: z.number().min(0).max(90).default(0),
})

export const GetUserStatsRequestSchema = z.object({
  oposicion: z.enum(OPOSICION_SLUGS),
  userId: z.string().uuid(),
})

export const GetThemeStatsRequestSchema = z.object({
  oposicion: z.enum(OPOSICION_SLUGS),
  themeId: z.number(),
  userId: z.string().uuid(),
})

// ============================================
// RESPONSE SCHEMAS
// ============================================

export const ThemeQuestionCountSchema = z.object({
  themeId: z.number(),
  count: z.number(),
  officialCount: z.number().default(0),
})

export const ConfigResponseSchema = z.object({
  success: z.boolean(),
  config: OposicionConfigSchema.optional(),
  themeCounts: z.array(ThemeQuestionCountSchema).optional(),
  error: z.string().optional(),
})

export const AvailabilityResponseSchema = z.object({
  success: z.boolean(),
  availableQuestions: z.number().default(0),
  byTheme: z.record(z.string(), z.number()).optional(),
  error: z.string().optional(),
})

export const UserThemeStatsSchema = z.object({
  themeId: z.number(),
  totalAnswered: z.number(),
  correctAnswers: z.number(),
  accuracy: z.number(),
  lastStudied: z.string().nullable(),
})

export const UserStatsResponseSchema = z.object({
  success: z.boolean(),
  stats: z.array(UserThemeStatsSchema).optional(),
  error: z.string().optional(),
})

export const GeneratedQuestionSchema = z.object({
  id: z.string().uuid(),
  questionText: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  difficulty: z.string().nullable(),
  globalDifficultyCategory: z.string().nullable(),
  isOfficialExam: z.boolean().nullable(),
  examSource: z.string().nullable(),
  articleNumber: z.string().nullable(),
  lawShortName: z.string().nullable(),
})

export const GenerateTestResponseSchema = z.object({
  success: z.boolean(),
  testId: z.string().uuid().optional(),
  questions: z.array(GeneratedQuestionSchema).optional(),
  totalGenerated: z.number().optional(),
  error: z.string().optional(),
})

// ============================================
// CONFIGURACIÓN DE BLOQUES POR OPOSICIÓN (derivado de config central)
// ============================================

export const OPOSICION_BLOCKS_CONFIG: Record<string, {
  name: string
  shortName: string
  badge: string
  icon: string
  blocks: Array<{
    id: string
    title: string
    subtitle: string | null
    icon: string
    themes: Array<{ id: number; name: string }>
  }>
}> = Object.fromEntries(
  OPOSICIONES.map(o => [o.slug, {
    name: o.name,
    shortName: o.shortName,
    badge: o.badge,
    icon: o.emoji,
    blocks: o.blocks,
  }])
)

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type Theme = z.infer<typeof ThemeSchema>
export type ThemeBlock = z.infer<typeof ThemeBlockSchema>
export type OposicionConfig = z.infer<typeof OposicionConfigSchema>
export type GetConfigRequest = z.infer<typeof GetConfigRequestSchema>
export type CheckAvailabilityRequest = z.infer<typeof CheckAvailabilityRequestSchema>
export type GenerateTestRequest = z.infer<typeof GenerateTestRequestSchema>
export type GetUserStatsRequest = z.infer<typeof GetUserStatsRequestSchema>
export type ConfigResponse = z.infer<typeof ConfigResponseSchema>
export type AvailabilityResponse = z.infer<typeof AvailabilityResponseSchema>
export type UserStatsResponse = z.infer<typeof UserStatsResponseSchema>
export type GenerateTestResponse = z.infer<typeof GenerateTestResponseSchema>
export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>
export type ThemeQuestionCount = z.infer<typeof ThemeQuestionCountSchema>
export type UserThemeStats = z.infer<typeof UserThemeStatsSchema>

// ============================================
// HELPERS DE VALIDACIÓN
// ============================================

export function isValidOposicion(slug: string): boolean {
  return OPOSICION_SLUGS.includes(slug)
}

export function getPositionType(oposicion: string): string {
  return POSITION_TYPE_MAP[oposicion]
}

export function getOposicionConfig(oposicion: string) {
  const config = OPOSICION_BLOCKS_CONFIG[oposicion]
  if (!config) throw new Error(`Oposición no válida: ${oposicion}`)
  return {
    slug: oposicion,
    ...config,
    positionType: POSITION_TYPE_MAP[oposicion],
    totalThemes: config.blocks.reduce((sum, block) => sum + block.themes.length, 0),
  }
}

export function safeParseCheckAvailability(data: unknown) {
  return CheckAvailabilityRequestSchema.safeParse(data)
}

export function safeParseGenerateTest(data: unknown) {
  return GenerateTestRequestSchema.safeParse(data)
}
