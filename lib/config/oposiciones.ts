// lib/config/oposiciones.ts - Fuente de verdad centralizada para configuración de oposiciones
// Todos los datos de oposiciones (IDs, slugs, nombres, bloques, temas) deben importarse de aquí.
import { z } from 'zod'

// ============================================
// ZOD SCHEMAS
// ============================================

const ThemeSchema = z.object({
  id: z.number(),
  name: z.string(),
})

const BlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  icon: z.string(),
  themes: z.array(ThemeSchema),
})

const NavLinkSchema = z.object({
  href: z.string(),
  label: z.string(),
  icon: z.string(),
  featured: z.boolean().optional(),
})

const OposicionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  positionType: z.string(),
  name: z.string(),
  shortName: z.string(),
  emoji: z.string(),
  badge: z.string(),
  color: z.string(),
  blocks: z.array(BlockSchema),
  totalTopics: z.number(),
  navLinks: z.array(NavLinkSchema),
})

// ============================================
// TIPOS DERIVADOS
// ============================================

export type Theme = z.infer<typeof ThemeSchema>
export type Block = z.infer<typeof BlockSchema>
export type NavLink = z.infer<typeof NavLinkSchema>
export type Oposicion = z.infer<typeof OposicionSchema>

// ============================================
// DATOS: LAS 4 OPOSICIONES
// ============================================

export const OPOSICIONES: Oposicion[] = [
  // ========================================
  // AUXILIAR ADMINISTRATIVO DEL ESTADO (C2)
  // ========================================
  {
    id: 'auxiliar_administrativo_estado',
    slug: 'auxiliar-administrativo-estado',
    positionType: 'auxiliar_administrativo',
    name: 'Auxiliar Administrativo del Estado',
    shortName: 'Auxiliar Admin.',
    emoji: '👤',
    badge: 'C2',
    color: 'emerald',
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
          { id: 15, name: 'El Presupuesto del Estado en España' },
          { id: 16, name: 'Políticas de Igualdad y contra la Violencia de Género' },
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
    totalTopics: 28,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxiliar-administrativo-estado', label: 'Mi Oposición', icon: '🏛️', featured: true },
      { href: '/auxiliar-administrativo-estado/temario', label: 'Temario', icon: '📚' },
      { href: '/auxiliar-administrativo-estado/test', label: 'Tests', icon: '🎯' },
      { href: '/auxiliar-administrativo-estado/simulacros', label: 'Simulacros', icon: '🏆' },
    ],
  },

  // ========================================
  // ADMINISTRATIVO DEL ESTADO (C1)
  // ========================================
  {
    id: 'administrativo_estado',
    slug: 'administrativo-estado',
    positionType: 'administrativo',
    name: 'Administrativo del Estado',
    shortName: 'Admin. Estado',
    emoji: '👨‍💼',
    badge: 'C1',
    color: 'blue',
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
    totalTopics: 61,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/administrativo-estado', label: 'Mi Oposición', icon: '🏢', featured: true },
      { href: '/administrativo-estado/temario', label: 'Temario', icon: '📚' },
      { href: '/administrativo-estado/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // TRAMITACIÓN PROCESAL (C1)
  // ========================================
  {
    id: 'tramitacion_procesal',
    slug: 'tramitacion-procesal',
    positionType: 'tramitacion_procesal',
    name: 'Tramitación Procesal y Administrativa',
    shortName: 'Tramitación Proc.',
    emoji: '⚖️',
    badge: 'C1',
    color: 'purple',
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
    totalTopics: 37,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/tramitacion-procesal', label: 'Mi Oposición', icon: '⚖️', featured: true },
      { href: '/tramitacion-procesal/temario', label: 'Temario', icon: '📚' },
      { href: '/tramitacion-procesal/test', label: 'Tests', icon: '🎯' },
    ],
  },

  // ========================================
  // AUXILIO JUDICIAL (C2)
  // ========================================
  {
    id: 'auxilio_judicial',
    slug: 'auxilio-judicial',
    positionType: 'auxilio_judicial',
    name: 'Auxilio Judicial',
    shortName: 'Auxilio Jud.',
    emoji: '⚖️',
    badge: 'C2',
    color: 'purple',
    blocks: [
      {
        id: 'bloque1',
        title: 'Bloque I: Derecho Constitucional y Organización del Estado',
        subtitle: 'Constitución y Organización del Estado',
        icon: '🏛️',
        themes: [
          { id: 1, name: 'La Constitución Española de 1978' },
          { id: 2, name: 'Igualdad y no discriminación' },
          { id: 3, name: 'El Gobierno y la Administración' },
          { id: 4, name: 'Organización territorial del Estado' },
          { id: 5, name: 'La Unión Europea' },
        ],
      },
      {
        id: 'bloque2',
        title: 'Bloque II: Organización Judicial y Funcionarios',
        subtitle: 'Poder Judicial, Tribunales y Funcionarios',
        icon: '⚖️',
        themes: [
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
        id: 'bloque3',
        title: 'Bloque III: Procedimientos y Actos Procesales',
        subtitle: 'Procedimientos, Registros y Archivo',
        icon: '📜',
        themes: [
          { id: 16, name: 'Procedimientos declarativos LEC' },
          { id: 17, name: 'Procedimientos de ejecución LEC' },
          { id: 18, name: 'Procesos especiales LEC' },
          { id: 19, name: 'La jurisdicción voluntaria' },
          { id: 20, name: 'Procedimientos penales' },
          { id: 21, name: 'El recurso contencioso-administrativo' },
          { id: 22, name: 'El proceso laboral' },
          { id: 23, name: 'Los actos procesales' },
          { id: 24, name: 'Las resoluciones judiciales' },
          { id: 25, name: 'El Registro Civil' },
          { id: 26, name: 'El archivo judicial' },
        ],
      },
    ],
    totalTopics: 26,
    navLinks: [
      { href: '/es', label: 'Inicio', icon: '🏠' },
      { href: '/auxilio-judicial', label: 'Mi Oposición', icon: '⚖️', featured: true },
      { href: '/auxilio-judicial/temario', label: 'Temario', icon: '📚' },
      { href: '/auxilio-judicial/test', label: 'Tests', icon: '🎯' },
    ],
  },
]

// ============================================
// VALORES DERIVADOS (para Zod enums y mapas)
// ============================================

/** Todos los IDs de oposición (para BD target_oposicion) */
export const ALL_OPOSICION_IDS = OPOSICIONES.map(o => o.id)

/** Todos los slugs de oposición (para URLs) */
export const ALL_OPOSICION_SLUGS = OPOSICIONES.map(o => o.slug)

/** Todos los positionType (para BD topics.position_type) */
export const ALL_POSITION_TYPES = OPOSICIONES.map(o => o.positionType)

/** Mapa slug → positionType */
export const SLUG_TO_POSITION_TYPE: Record<string, string> = Object.fromEntries(
  OPOSICIONES.map(o => [o.slug, o.positionType])
)

/** Mapa id → positionType */
export const ID_TO_POSITION_TYPE: Record<string, string> = Object.fromEntries(
  OPOSICIONES.map(o => [o.id, o.positionType])
)

/** Mapa id → slug */
export const ID_TO_SLUG: Record<string, string> = Object.fromEntries(
  OPOSICIONES.map(o => [o.id, o.slug])
)

/** Mapa slug → id */
export const SLUG_TO_ID: Record<string, string> = Object.fromEntries(
  OPOSICIONES.map(o => [o.slug, o.id])
)

// ============================================
// FUNCIONES HELPER
// ============================================

/** Busca una oposición por su slug de URL */
export function getOposicionBySlug(slug: string): Oposicion | undefined {
  return OPOSICIONES.find(o => o.slug === slug)
}

/** Busca una oposición por su ID de BD (target_oposicion) */
export function getOposicionById(id: string): Oposicion | undefined {
  return OPOSICIONES.find(o => o.id === id)
}

/** Busca una oposición por su positionType de BD */
export function getOposicionByPositionType(positionType: string): Oposicion | undefined {
  return OPOSICIONES.find(o => o.positionType === positionType)
}

/**
 * Busca una oposición por cualquier identificador (id, slug, o positionType).
 * Útil cuando no se sabe qué tipo de identificador se tiene.
 */
export function getOposicion(identifier: string): Oposicion | undefined {
  return getOposicionById(identifier) || getOposicionBySlug(identifier) || getOposicionByPositionType(identifier)
}

/** Devuelve el enlace a /test para una oposición dada (por id o slug) */
export function getTestsLink(identifier: string): string {
  const oposicion = getOposicion(identifier)
  return oposicion ? `/${oposicion.slug}/test` : '/'
}

/** Devuelve el enlace a /temario para una oposición dada (por id o slug) */
export function getTemarioLink(identifier: string): string {
  const oposicion = getOposicion(identifier)
  return oposicion ? `/${oposicion.slug}/temario` : '/'
}

const ROMAN_NUMERALS = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii']

/**
 * Determina el bloque para un tema dado en una oposición.
 * Retorna { blockId, blockTitle, displayNum } o null si no se encuentra.
 * blockId usa numeración romana (bloque-i, bloque-ii, ...) para coincidir con anchors HTML.
 * displayNum ajusta automáticamente para bloques con offset (ej: tema 101 → display 1).
 */
export function getBlockForTopic(identifier: string, topicNum: number): {
  blockId: string
  blockTitle: string
  displayNum: number
} | null {
  const oposicion = getOposicion(identifier)
  if (!oposicion) return null

  for (let i = 0; i < oposicion.blocks.length; i++) {
    const block = oposicion.blocks[i]
    const theme = block.themes.find(t => t.id === topicNum)
    if (theme) {
      const firstId = block.themes[0].id
      // Si el primer tema del bloque tiene ID >= 100, es offset-based
      const displayNum = firstId >= 100 ? topicNum - firstId + 1 : topicNum
      return {
        blockId: `bloque-${ROMAN_NUMERALS[i]}`,
        blockTitle: block.title.split(':')[0]?.trim() || block.title,
        displayNum,
      }
    }
  }
  return null
}

/** Convierte slug a positionType para queries a BD */
export function slugToPositionType(slug: string): string | null {
  return SLUG_TO_POSITION_TYPE[slug] ?? null
}

/** Convierte positionType a slug para URLs */
export function positionTypeToSlug(positionType: string): string | null {
  const oposicion = getOposicionByPositionType(positionType)
  return oposicion?.slug ?? null
}

/** Obtiene todos los temas de una oposición como lista plana */
export function getAllThemes(identifier: string): Theme[] {
  const oposicion = getOposicion(identifier)
  if (!oposicion) return []
  return oposicion.blocks.flatMap(block => block.themes)
}

/** Obtiene el nombre de un tema por su ID */
export function getThemeName(identifier: string, themeId: number): string {
  const themes = getAllThemes(identifier)
  return themes.find(t => t.id === themeId)?.name || ''
}

/** Obtiene los nombres de múltiples temas */
export function getThemeNames(identifier: string, themeIds: number[]): Record<number, string> {
  const themes = getAllThemes(identifier)
  const result: Record<number, string> = {}
  for (const id of themeIds) {
    const theme = themes.find(t => t.id === id)
    if (theme) result[id] = theme.name
  }
  return result
}

/** Lista de oposiciones disponibles (datos básicos) */
export function getAvailableOposiciones() {
  return OPOSICIONES.map(o => ({
    id: o.id,
    name: o.name,
    shortName: o.shortName,
    slug: o.slug,
    totalTopics: o.totalTopics,
  }))
}

/** Valida si un identificador corresponde a una oposición existente */
export function isValidOposicion(identifier: string): boolean {
  return getOposicion(identifier) !== undefined
}

// ============================================
// COMPATIBILIDAD: Re-exportar con nombres del viejo .js
// ============================================

/** @deprecated Usar OPOSICIONES directamente */
export const OPOSICIONES_CONFIG: Record<string, {
  id: string
  name: string
  shortName: string
  slug: string
  positionType: string
  totalThemes: number
  themeBlocks: Array<{
    id: string
    title: string
    subtitle: string | null
    themes: Theme[]
  }>
}> = Object.fromEntries(
  OPOSICIONES.map(o => [o.positionType === 'auxiliar_administrativo' ? 'auxiliar_administrativo' : o.id, {
    id: o.id,
    name: o.name,
    shortName: o.shortName,
    slug: o.slug,
    positionType: o.positionType,
    totalThemes: o.totalTopics,
    themeBlocks: o.blocks.map(b => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      themes: b.themes,
    })),
  }])
)

/** @deprecated Usar getOposicion() */
export function getOposicionConfig(identifier: string) {
  return getOposicion(identifier) ? OPOSICIONES_CONFIG[identifier] || Object.values(OPOSICIONES_CONFIG).find(c => c.slug === identifier) || null : null
}

export default OPOSICIONES
