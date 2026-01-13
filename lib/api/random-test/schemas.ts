// lib/api/random-test/schemas.ts - Schemas Zod para Test Aleatorio
import { z } from 'zod'

// ============================================
// CONSTANTES Y TIPOS BASE
// ============================================

export const OPOSICION_SLUGS = [
  'auxiliar-administrativo-estado',
  'administrativo-estado',
  'tramitacion-procesal',
] as const

export type OposicionSlug = (typeof OPOSICION_SLUGS)[number]

export const POSITION_TYPE_MAP: Record<OposicionSlug, string> = {
  'auxiliar-administrativo-estado': 'auxiliar_administrativo',
  'administrativo-estado': 'administrativo',
  'tramitacion-procesal': 'tramitacion_procesal',
}

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
// CONFIGURACIÓN DE BLOQUES POR OPOSICIÓN
// ============================================

export const OPOSICION_BLOCKS_CONFIG: Record<OposicionSlug, {
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
}> = {
  'auxiliar-administrativo-estado': {
    name: 'Auxiliar Administrativo del Estado',
    shortName: 'Auxiliar Administrativo',
    badge: 'C2',
    icon: '👤',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Organización Pública',
        subtitle: 'Derecho Constitucional y Administrativo',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'El Tribunal Constitucional. La Corona' },
          { id: 3, name: 'Las Cortes Generales' },
          { id: 4, name: 'El Poder Judicial' },
          { id: 5, name: 'El Gobierno y la Administración' },
          { id: 6, name: 'El Gobierno Abierto. Agenda 2030' },
          { id: 7, name: 'Ley 19/2013 de Transparencia' },
          { id: 8, name: 'La Administración General del Estado' },
          { id: 9, name: 'La Organización Territorial del Estado' },
          { id: 10, name: 'La Organización de la Unión Europea' },
          { id: 11, name: 'Las Leyes del Procedimiento Administrativo' },
          { id: 12, name: 'La Protección de Datos Personales' },
          { id: 13, name: 'El Personal Funcionario' },
          { id: 14, name: 'Derechos y Deberes de los Funcionarios' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Actividad Administrativa',
        subtitle: 'Informática y Atención al Ciudadano',
        icon: '💻',
        themes: [
          { id: 101, name: 'Atención al ciudadano' },
          { id: 102, name: 'Servicios de información administrativa' },
          { id: 103, name: 'Documento, registro y archivo' },
          { id: 104, name: 'Administración electrónica' },
          { id: 105, name: 'Informática básica' },
          { id: 106, name: 'Sistema operativo Windows 11' },
          { id: 107, name: 'Explorador de Windows 11' },
          { id: 108, name: 'Word' },
          { id: 109, name: 'Excel' },
          { id: 110, name: 'Access' },
          { id: 111, name: 'Correo electrónico' },
          { id: 112, name: 'Internet' },
        ],
      },
    ],
  },
  'administrativo-estado': {
    name: 'Administrativo del Estado',
    shortName: 'Administrativo',
    badge: 'C1',
    icon: '👨‍💼',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Organización del Estado',
        subtitle: null,
        icon: '🏛️',
        themes: Array.from({ length: 14 }, (_, i) => ({
          id: i + 1,
          name: `Tema ${i + 1}`,
        })),
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Administración General',
        subtitle: null,
        icon: '📋',
        themes: Array.from({ length: 14 }, (_, i) => ({
          id: 101 + i,
          name: `Tema ${i + 1}`,
        })),
      },
      {
        id: 'bloque3',
        title: 'Bloque III: Gestión de Personal',
        subtitle: null,
        icon: '👥',
        themes: Array.from({ length: 10 }, (_, i) => ({
          id: 201 + i,
          name: `Tema ${i + 1}`,
        })),
      },
      {
        id: 'bloque4',
        title: 'Bloque IV: Gestión Financiera',
        subtitle: null,
        icon: '💰',
        themes: Array.from({ length: 9 }, (_, i) => ({
          id: 301 + i,
          name: `Tema ${i + 1}`,
        })),
      },
      {
        id: 'bloque5',
        title: 'Bloque V: Informática Básica',
        subtitle: null,
        icon: '💻',
        themes: Array.from({ length: 6 }, (_, i) => ({
          id: 501 + i,
          name: `Tema ${i + 1}`,
        })),
      },
      {
        id: 'bloque6',
        title: 'Bloque VI: Administración Electrónica',
        subtitle: null,
        icon: '🌐',
        themes: Array.from({ length: 8 }, (_, i) => ({
          id: 601 + i,
          name: `Tema ${i + 1}`,
        })),
      },
    ],
  },
  'tramitacion-procesal': {
    name: 'Tramitación Procesal y Administrativa',
    shortName: 'Tramitación Procesal',
    badge: 'C1',
    icon: '⚖️',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Organización del Estado y Administración de Justicia',
        subtitle: 'Constitución, Poder Judicial y Funcionarios',
        icon: '⚖️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Igualdad y no discriminación' },
          { id: 3, name: 'El Gobierno y la Administración' },
          { id: 4, name: 'Organización territorial del Estado' },
          { id: 5, name: 'La Unión Europea' },
          { id: 6, name: 'El Poder Judicial' },
          { id: 7, name: 'Organización y competencia (I)' },
          { id: 8, name: 'Organización y competencia (II)' },
          { id: 9, name: 'Carta de Derechos ante la Justicia' },
          { id: 10, name: 'La modernización de la oficina judicial' },
          { id: 11, name: 'El Letrado de la Administración de Justicia' },
          { id: 12, name: 'Los Cuerpos de funcionarios' },
          { id: 13, name: 'Los Cuerpos Generales (I)' },
          { id: 14, name: 'Los Cuerpos Generales (II)' },
          { id: 15, name: 'Libertad sindical' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Derecho Procesal',
        subtitle: 'Procedimientos civiles, penales y administrativos',
        icon: '📜',
        themes: [
          { id: 16, name: 'Procedimientos declarativos LEC' },
          { id: 17, name: 'Procedimientos de ejecución LEC' },
          { id: 18, name: 'Procesos especiales LEC' },
          { id: 19, name: 'La jurisdicción voluntaria' },
          { id: 20, name: 'Procedimientos penales (I)' },
          { id: 21, name: 'Procedimientos penales (II)' },
          { id: 22, name: 'El recurso contencioso-administrativo' },
          { id: 23, name: 'El proceso laboral' },
          { id: 24, name: 'Los recursos' },
          { id: 25, name: 'Los actos procesales' },
          { id: 26, name: 'Las resoluciones judiciales' },
          { id: 27, name: 'Comunicación con otros tribunales' },
          { id: 28, name: 'Comunicación a las partes' },
          { id: 29, name: 'El Registro Civil (I)' },
          { id: 30, name: 'El Registro Civil (II)' },
          { id: 31, name: 'El archivo judicial' },
        ],
      },
      {
        id: 'bloque3',
        title: 'Bloque III: Informática',
        subtitle: 'Ofimática y tecnología',
        icon: '💻',
        themes: [
          { id: 32, name: 'Informática básica' },
          { id: 33, name: 'Sistema operativo Windows' },
          { id: 34, name: 'El explorador de Windows' },
          { id: 35, name: 'Procesadores de texto: Word 365' },
          { id: 36, name: 'Correo electrónico: Outlook 365' },
          { id: 37, name: 'La Red Internet' },
        ],
      },
    ],
  },
}

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

export function isValidOposicion(slug: string): slug is OposicionSlug {
  return OPOSICION_SLUGS.includes(slug as OposicionSlug)
}

export function getPositionType(oposicion: OposicionSlug): string {
  return POSITION_TYPE_MAP[oposicion]
}

export function getOposicionConfig(oposicion: OposicionSlug) {
  const config = OPOSICION_BLOCKS_CONFIG[oposicion]
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
