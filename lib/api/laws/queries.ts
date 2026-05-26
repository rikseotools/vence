// lib/api/laws/queries.ts - Queries Drizzle para Leyes
//
// Capa de acceso a datos 100% tipada con Drizzle + Zod.
// Reemplaza progresivamente a lawMappingUtils.ts como fuente de verdad.
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getLawsDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { laws, articles, questions } from '@/db/schema'
import { eq, and, sql, count, isNotNull } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import {
  LawWithCountsSchema,
  LawResolvedSchema,
  type LawWithCounts,
  type LawResolved,
  type LawInfo,
  type GetLawsWithCountsResponse,
  type SlugMappingCache,
  type SlugMappingEntry,
  SLUG_CACHE_MAX_AGE_MS,
} from './schemas'

// ============================================
// PATRONES PARA GENERACIÓN DINÁMICA DE SLUGS
// ============================================

interface SlugPattern {
  regex: RegExp
  transform: (match: RegExpMatchArray) => string
}

/** Patrones regex para inferir short_name desde un slug desconocido */
const SLUG_TO_SHORTNAME_PATTERNS: SlugPattern[] = [
  { regex: /^lo-(\d+)-(\d+)$/, transform: (m) => `LO ${m[1]}/${m[2]}` },
  { regex: /^ley-(\d+)-(\d+)$/, transform: (m) => `Ley ${m[1]}/${m[2]}` },
  { regex: /^rdl-(\d+)-(\d+)$/, transform: (m) => `RDL ${m[1]}/${m[2]}` },
  { regex: /^rd-(\d+)-(\d+)$/, transform: (m) => `RD ${m[1]}/${m[2]}` },
  { regex: /^decreto-(\d+)-(\d+)$/, transform: (m) => `Decreto ${m[1]}/${m[2]}` },
  { regex: /^orden-([a-z]+)-(\d+)-(\d+)$/i, transform: (m) => `Orden ${m[1].toUpperCase()}/${m[2]}/${m[3]}` },
  { regex: /^reglamento-ue-(\d+)-(\d+)$/, transform: (m) => `Reglamento UE ${m[1]}/${m[2]}` },
]

/**
 * Intenta inferir un short_name a partir de un slug con patrones regex.
 * Fallback de último recurso cuando el slug no está en BD.
 */
function inferShortNameFromSlug(slug: string): string | null {
  for (const pattern of SLUG_TO_SHORTNAME_PATTERNS) {
    const match = slug.match(pattern.regex)
    if (match) return pattern.transform(match)
  }
  return null
}

// ============================================
// NORMALIZACIÓN DE SLUGS
// ============================================

/**
 * Normaliza un slug de URL: decodifica URI, limpia caracteres raros.
 */
function normalizeSlug(rawSlug: string): string {
  let slug = rawSlug
  try {
    slug = decodeURIComponent(rawSlug)
  } catch {
    // Si falla la decodificación, usar el original
  }
  // Limpiar dos puntos sueltos (ej: "base-de-datos:-access" → "base-de-datos-access")
  return slug.replace(/:-/g, '-').replace(/:$/g, '')
}

// ============================================
// CACHE DE MAPEO SLUG ↔ SHORT_NAME (DRIZZLE)
// ============================================
//
// IMPORTANTE — fix incidente OOM 2026-05-26 (task #117 parte B):
//
// Antes: `let slugMappingCache: SlugMappingCache | null = null` a nivel
// módulo. PROBLEMA: Next.js bundlea este módulo varias veces (Server
// Component bundle, API Route bundle, Middleware bundle, etc.). Cada bundle
// tiene SU PROPIA copia del `let` → no se comparte → cada bundle recarga
// el cache de ~30-50 leyes desde BD, mantiene ~50 Maps con strong refs
// vivos por bundle, y el GC no puede liberar.
//
// Síntoma observado en producción ECS bajo carga: logs mostraban
// "🔄 [LawsAPI] Cargando cache de slugs desde BD..." decenas de veces por
// minuto con TTL de 1h (debería ser 1 vez/h). Memoria del task subía
// 71% → 99.8% en 30 min y disparaba OOM kill.
//
// Fix: storage en `globalThis` con key versionada. globalThis es UNA SOLA
// instancia compartida por TODO el runtime Node — todos los bundles
// referencian el mismo slot. Una sola carga real, GC libera correctamente.
//
// Si en el futuro cambia la forma del SlugMappingCache (campo nuevo), subir
// la versión en CACHE_KEY (`_v2`, `_v3`...) para invalidar caches viejos
// que sobrevivan a un hot reload.

const CACHE_KEY = '__vence_slug_mapping_cache_v1'

function getCachedSlugMapping(): SlugMappingCache | null {
  return (globalThis as unknown as Record<string, SlugMappingCache | null | undefined>)[CACHE_KEY] ?? null
}

function setCachedSlugMapping(value: SlugMappingCache | null): void {
  (globalThis as unknown as Record<string, SlugMappingCache | null>)[CACHE_KEY] = value
}

function isCacheValid(): boolean {
  const cached = getCachedSlugMapping()
  if (!cached) return false
  return Date.now() - cached.loadedAt.getTime() < SLUG_CACHE_MAX_AGE_MS
}

/**
 * Carga el mapeo completo slug ↔ short_name + datos de ley desde BD.
 * Cache compartido cross-bundle via `globalThis` (ver comentario arriba).
 */
export async function loadSlugMappingCache(): Promise<SlugMappingCache> {
  const cached = getCachedSlugMapping()
  if (isCacheValid() && cached) {
    return cached
  }

  console.log('🔄 [LawsAPI] Cargando cache de slugs desde BD...')
  const db = getLawsDb()

  const result = await db
    .select({
      id: laws.id,
      shortName: laws.shortName,
      slug: laws.slug,
      name: laws.name,
      description: laws.description,
      year: laws.year,
      type: laws.type,
    })
    .from(laws)
    .where(and(eq(laws.isActive, true), isNotNull(laws.slug)))

  const slugToShortName = new Map<string, string>()
  const shortNameToSlug = new Map<string, string>()
  const lawsBySlug = new Map<string, LawResolved>()

  for (const law of result) {
    if (!law.slug) continue
    slugToShortName.set(law.slug, law.shortName)
    shortNameToSlug.set(law.shortName, law.slug)

    const parsed = LawResolvedSchema.safeParse(law)
    if (parsed.success) {
      lawsBySlug.set(law.slug, parsed.data)
    }
  }

  const newCache: SlugMappingCache = {
    slugToShortName,
    shortNameToSlug,
    lawsBySlug,
    loadedAt: new Date(),
  }
  setCachedSlugMapping(newCache)

  console.log(`✅ [LawsAPI] Cache cargado: ${slugToShortName.size} leyes`)
  return newCache
}

/** Invalida el cache (llamar después de actualizar leyes) */
export function invalidateSlugCache(): void {
  setCachedSlugMapping(null)
  console.log('🗑️ [LawsAPI] Cache de slugs invalidado')
}

// ============================================
// RESOLUCIÓN DE LEYES (API PRINCIPAL)
// ============================================

/**
 * Resuelve una ley completa a partir de su slug.
 * Orden: cache en memoria → BD directa → pattern fallback.
 * Retorna null si el slug no corresponde a ninguna ley activa.
 */
export async function resolveLawBySlug(rawSlug: string): Promise<LawResolved | null> {
  const slug = normalizeSlug(rawSlug)

  // 1. Cache en memoria (fast path)
  const cache = await loadSlugMappingCache()
  const cached = cache.lawsBySlug.get(slug) ?? cache.lawsBySlug.get(rawSlug)
  if (cached) return cached

  // 2. BD directa (slug nuevo no cacheado)
  const db = getLawsDb()
  const [row] = await db
    .select({
      id: laws.id,
      shortName: laws.shortName,
      slug: laws.slug,
      name: laws.name,
      description: laws.description,
      year: laws.year,
      type: laws.type,
    })
    .from(laws)
    .where(and(eq(laws.slug, slug), eq(laws.isActive, true)))
    .limit(1)

  if (row?.slug) {
    const parsed = LawResolvedSchema.safeParse(row)
    if (parsed.success) {
      // Actualizar cache en caliente
      cache.lawsBySlug.set(slug, parsed.data)
      cache.slugToShortName.set(slug, parsed.data.shortName)
      cache.shortNameToSlug.set(parsed.data.shortName, slug)
      return parsed.data
    }
  }

  // 3. Fallback: resolver como identificador genérico (short_name, slug generado, etc.)
  const resolved = await resolveLawIdentifier(rawSlug)
  if (resolved) {
    const law = cache.lawsBySlug.get(resolved.slug)
    if (law) return law
  }

  return null
}

/**
 * Obtiene el short_name a partir del slug.
 * Usa cache en memoria. Para server components y libs.
 */
export async function getShortNameBySlug(rawSlug: string): Promise<string | null> {
  const slug = normalizeSlug(rawSlug)
  const cache = await loadSlugMappingCache()
  const result = cache.slugToShortName.get(slug) ?? cache.slugToShortName.get(rawSlug)
  if (result) return result

  // Fallback: pattern-based inference
  return inferShortNameFromSlug(slug)
}

/**
 * Obtiene el slug a partir del short_name.
 * Usa cache en memoria. Para server components y libs.
 */
export async function getSlugByShortName(shortName: string): Promise<string | null> {
  const cache = await loadSlugMappingCache()
  return cache.shortNameToSlug.get(shortName) ?? null
}

/**
 * Genera un slug automáticamente desde un short_name (fallback cuando no está en BD).
 * Determinista: el mismo input produce siempre el mismo output.
 */
export function generateSlugFromShortName(shortName: string): string {
  if (!shortName) return 'unknown'
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
 * Obtiene el slug canónico para un short_name.
 * Primero intenta BD, luego genera automáticamente.
 */
export async function getCanonicalSlugAsync(shortName: string | null | undefined): Promise<string> {
  if (!shortName) return 'unknown'
  const dbSlug = await getSlugByShortName(shortName)
  return dbSlug ?? generateSlugFromShortName(shortName)
}

/**
 * Obtiene info de una ley (nombre + descripción) desde su slug.
 * Compatible con el LawInfo de lawMappingUtils.
 */
export async function getLawInfoBySlug(rawSlug: string): Promise<LawInfo | null> {
  const resolved = await resolveLawBySlug(rawSlug)
  if (resolved) {
    return {
      name: resolved.name,
      description: resolved.description ?? `Test de ${resolved.shortName}`,
    }
  }

  // Fallback: intentar pattern inference para generar un nombre mínimo
  const slug = normalizeSlug(rawSlug)
  const inferred = inferShortNameFromSlug(slug)
  if (inferred) {
    return { name: inferred, description: `Test de ${inferred}` }
  }

  return null
}

/**
 * Devuelve todos los slugs activos de la BD.
 * Para generateStaticParams en build time.
 */
export async function getAllActiveSlugs(): Promise<string[]> {
  try {
    const cache = await loadSlugMappingCache()
    return Array.from(cache.slugToShortName.keys())
  } catch (error) {
    console.warn('⚠️ [LawsAPI] Error obteniendo slugs, retornando vacío:', error)
    return []
  }
}

/**
 * Devuelve el mapping completo para el endpoint /api/v2/law-slugs.
 * Incluye shortName, name y description para cada slug.
 */
export async function getSlugMappingForApi(): Promise<SlugMappingEntry[]> {
  const cache = await loadSlugMappingCache()
  const entries: SlugMappingEntry[] = []

  for (const [slug, law] of cache.lawsBySlug) {
    entries.push({
      slug,
      shortName: law.shortName,
      name: law.name,
      description: law.description,
    })
  }

  return entries
}

// ============================================
// RESOLVER UNIVERSAL DE LEYES
// ============================================

/**
 * Resuelve cualquier identificador de ley (slug, short_name, o variante)
 * a sus datos completos. Un solo punto de resolución para toda la app.
 *
 * Intenta en orden:
 * 1. Como slug (ej: "constitucion-espanola")
 * 2. Como short_name exacto (ej: "CE", "Ley 39/2015")
 * 3. Como slug generado desde short_name (ej: "ce" → busca "CE" en cache)
 *
 * @returns { id, shortName, slug, name } o null si no existe
 */
export async function resolveLawIdentifier(input: string): Promise<{
  id: string
  shortName: string
  slug: string
  name: string
} | null> {
  if (!input) return null
  const cache = await loadSlugMappingCache()

  // 1. Intentar como slug directo
  const bySlug = cache.slugToShortName.get(input) ?? cache.slugToShortName.get(normalizeSlug(input))
  if (bySlug) {
    const law = cache.lawsBySlug.get(input) ?? cache.lawsBySlug.get(normalizeSlug(input))
    if (law) return { id: law.id, shortName: law.shortName, slug: law.slug!, name: law.name }
  }

  // 2. Intentar como short_name exacto
  const slugFromShortName = cache.shortNameToSlug.get(input)
  if (slugFromShortName) {
    const law = cache.lawsBySlug.get(slugFromShortName)
    if (law) return { id: law.id, shortName: law.shortName, slug: law.slug!, name: law.name }
  }

  // 3. Intentar como slug generado exacto (ej: "ce" podría ser generateSlug("CE"))
  for (const [shortName, slug] of cache.shortNameToSlug) {
    if (generateSlugFromShortName(shortName) === normalizeSlug(input)) {
      const law = cache.lawsBySlug.get(slug)
      if (law) return { id: law.id, shortName: law.shortName, slug: law.slug!, name: law.name }
    }
  }

  // 4. Match parcial: el input es prefijo del slug canónico o del generado
  // Ej: "ley-31-1995" matchea "ley-31-1995-lprl" (prefijo)
  const normalInput = normalizeSlug(input)
  for (const [slug, law] of cache.lawsBySlug) {
    if (slug.startsWith(normalInput + '-') || generateSlugFromShortName(law.shortName).startsWith(normalInput + '-')) {
      return { id: law.id, shortName: law.shortName, slug: law.slug!, name: law.name }
    }
  }

  // 5. Match por partes: todas las partes del input existen en el slug canónico
  // Ej: "protocolo-6" → partes [protocolo, 6] → ambas están en "protocolo-n-6"
  const inputParts = normalInput.split('-').filter(p => p.length > 0)
  if (inputParts.length >= 2) {
    for (const [slug, law] of cache.lawsBySlug) {
      const slugParts = slug.split('-')
      if (inputParts.every(p => slugParts.includes(p))) {
        return { id: law.id, shortName: law.shortName, slug: law.slug!, name: law.name }
      }
    }
  }

  return null
}

// ============================================
// NORMALIZACIÓN DE NOMBRES DE LEY
// ============================================

/**
 * Mapa mínimo de normalización para variantes conocidas.
 * Solo contiene las pocas excepciones que la BD no cubre nativamente.
 */
const NORMALIZATION_MAP: Record<string, string> = {
  'RCD': 'Reglamento del Congreso',
  'RS': 'Reglamento del Senado',
  'Reglamento Congreso': 'Reglamento del Congreso',
}

/**
 * Normaliza el nombre de una ley a su forma canónica en BD.
 * Para las pocas variantes conocidas (3 entradas).
 */
export function normalizeLawShortName(shortName: string): string {
  return NORMALIZATION_MAP[shortName] ?? shortName
}

// ============================================
// OBTENER LEYES CON CONTEO DE PREGUNTAS (DRIZZLE)
// ============================================

// Lanza error en caso de fallo — unstable_cache NO cachea excepciones,
// solo valores de retorno. Así un timeout transitorio no envenena la caché 30 días.
async function getLawsWithQuestionCountsInternal(): Promise<LawWithCounts[]> {
  const db = getLawsDb()
  console.log('🚀 Obteniendo leyes con conteo (Drizzle Query Builder)...')
  console.time('⏱️ getLawsWithQuestionCounts')

  // Timeout de 15s para no bloquear el build de Vercel (límite 60s por página).
  const timeoutMs = 15_000
  const queryPromise = db
    .select({
      id: laws.id,
      name: laws.name,
      short_name: laws.shortName,
      description: laws.description,
      year: laws.year,
      type: laws.type,
      questionCount: count(questions.id),
      officialQuestions: sql<number>`COUNT(CASE WHEN ${questions.isOfficialExam} = true THEN 1 END)`,
    })
    .from(laws)
    .leftJoin(articles, eq(articles.lawId, laws.id))
    .leftJoin(
      questions,
      and(
        eq(questions.primaryArticleId, articles.id),
        eq(questions.isActive, true)
      )
    )
    .where(eq(laws.isActive, true))
    .groupBy(laws.id, laws.name, laws.shortName, laws.description, laws.year, laws.type)
    .orderBy(sql`COUNT(${questions.id}) DESC`)

  const result = await Promise.race([
    queryPromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`getLawsWithQuestionCounts timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ])

  console.timeEnd('⏱️ getLawsWithQuestionCounts')

  const lawsWithCounts: LawWithCounts[] = result
    .filter(law => Number(law.questionCount) >= 1)
    .map(law => {
      const parsed = LawWithCountsSchema.safeParse({
        id: law.id,
        name: law.name,
        short_name: law.short_name,
        description: law.description,
        year: law.year,
        type: law.type,
        questionCount: Number(law.questionCount),
        officialQuestions: Number(law.officialQuestions),
      })

      if (!parsed.success) {
        console.warn('⚠️ Ley con datos inválidos:', law.short_name, parsed.error.flatten())
        return null
      }
      return parsed.data
    })
    .filter((law): law is LawWithCounts => law !== null)

  console.log(`✅ ${lawsWithCounts.length} leyes con preguntas obtenidas`)
  return lawsWithCounts
}

// Cacheado 30 días. Al lanzar errores la función interna, unstable_cache no los cachea.
const getLawsWithQuestionCountsCached = unstable_cache(
  getLawsWithQuestionCountsInternal,
  ['laws-with-question-counts'],
  { revalidate: 2592000, tags: ['laws'] }
)

// API pública — captura errores del caché/query y devuelve respuesta estructurada.
export async function getLawsWithQuestionCounts(): Promise<GetLawsWithCountsResponse> {
  try {
    const laws = await getLawsWithQuestionCountsCached()
    return { success: true, laws }
  } catch (error) {
    console.error('❌ Error obteniendo leyes con conteo:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' }
  }
}

// ============================================
// FALLBACK: RETORNA ARRAY VACÍO
// ============================================

export async function getLawsBasic(): Promise<GetLawsWithCountsResponse> {
  console.warn('⚠️ Fallback activado: retornando lista vacía')
  return {
    success: true,
    laws: [],
  }
}
