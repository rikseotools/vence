// lib/lawSlugSync.ts - Cache síncrono de slugs de leyes
//
// Módulo ligero para client bundles (NO importa Drizzle ni postgres).
// Los Maps se pueblan desde warmSlugCache() (Supabase) al inicio de cada request.
// Sin diccionarios estáticos: todos los datos vienen de BD.
//
// Uso:
//   import { mapSlugToShortName, generateSlug } from '@/lib/lawSlugSync'

// ============================================
// CACHE SÍNCRONO
// ============================================

let slugToShortName: Map<string, string> | null = null
let shortNameToSlug: Map<string, string> | null = null

/**
 * Establece el cache síncrono desde datos de BD.
 * Llamado por warmSlugCache() en lib/api/laws/warmCache.ts
 */
export function setSyncCache(
  newSlugToShortName: Map<string, string>,
  newShortNameToSlug: Map<string, string>
): void {
  slugToShortName = newSlugToShortName
  shortNameToSlug = newShortNameToSlug
}

/** Invalida el cache */
export function invalidateSyncCache(): void {
  slugToShortName = null
  shortNameToSlug = null
}

/** Verifica si el cache está disponible */
export function isSyncCacheLoaded(): boolean {
  return slugToShortName !== null && shortNameToSlug !== null
}

// ============================================
// PATRONES PARA GENERACIÓN DINÁMICA
// ============================================

interface SlugPattern {
  regex: RegExp
  transform: (match: RegExpMatchArray) => string
}

const SLUG_PATTERNS: SlugPattern[] = [
  { regex: /^lo-(\d+)-(\d+)$/, transform: (m) => `LO ${m[1]}/${m[2]}` },
  { regex: /^ley-(\d+)-(\d+)$/, transform: (m) => `Ley ${m[1]}/${m[2]}` },
  { regex: /^rdl-(\d+)-(\d+)$/, transform: (m) => `RDL ${m[1]}/${m[2]}` },
  { regex: /^rd-(\d+)-(\d+)$/, transform: (m) => `RD ${m[1]}/${m[2]}` },
  { regex: /^decreto-(\d+)-(\d+)$/, transform: (m) => `Decreto ${m[1]}/${m[2]}` },
  { regex: /^orden-([a-z]+)-(\d+)-(\d+)$/i, transform: (m) => `Orden ${m[1].toUpperCase()}/${m[2]}/${m[3]}` },
  { regex: /^reglamento-ue-(\d+)-(\d+)$/, transform: (m) => `Reglamento UE ${m[1]}/${m[2]}` },
]

// ============================================
// NORMALIZACIÓN
// ============================================

const NORMALIZATION_MAP: Record<string, string> = {
  'RCD': 'Reglamento del Congreso',
  'RS': 'Reglamento del Senado',
  'Reglamento Congreso': 'Reglamento del Congreso',
}

// ============================================
// FUNCIONES EXPORTADAS
// ============================================

/**
 * Mapea un slug de URL al short_name de la BD.
 * Devuelve null si el slug no tiene mapeo conocido.
 *
 * Orden: cache BD → pattern fallback
 */
export function mapSlugToShortName(rawSlug: string): string | null {
  if (!rawSlug) return null

  // Decodificar URL-encoded slugs
  let slug = rawSlug
  try {
    slug = decodeURIComponent(rawSlug)
  } catch {
    // Si falla, usar original
  }
  // Limpiar colones (ej: "base-de-datos:-access" → "base-de-datos-access")
  slug = slug.replace(/:-/g, '-').replace(/:$/g, '')

  // 1. Cache de BD (fuente de verdad)
  if (slugToShortName) {
    const result = slugToShortName.get(slug) ?? slugToShortName.get(rawSlug)
    if (result) return result
  }

  // 2. Pattern fallback
  for (const pattern of SLUG_PATTERNS) {
    const match = slug.match(pattern.regex)
    if (match) return pattern.transform(match)
  }

  return null
}

/**
 * Genera un slug desde un short_name.
 * Primero intenta cache de BD, luego auto-genera.
 */
export function generateSlug(shortName: string): string {
  if (!shortName) return 'unknown'

  // 1. Cache de BD
  if (shortNameToSlug) {
    const result = shortNameToSlug.get(shortName)
    if (result) return result
  }

  // 2. Auto-generación determinista
  return shortName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Slug canónico (alias de generateSlug para compatibilidad)
 */
export function getCanonicalSlug(shortName: string | null | undefined): string {
  if (!shortName) return 'unknown'
  return generateSlug(shortName)
}

/**
 * Normaliza variantes de short_name a forma canónica
 */
export function normalizeLawShortName(shortName: string): string {
  return NORMALIZATION_MAP[shortName] ?? shortName
}
