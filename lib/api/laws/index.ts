// lib/api/laws/index.ts - Exportaciones del módulo de leyes

// Schemas y tipos
export {
  // Schemas
  lawSlugSchema,
  lawShortNameSchema,
  LawSlugMappingSchema,
  LawWithCountsSchema,
  LawResolvedSchema,
  LawInfoSchema,
  GetLawsWithCountsResponseSchema,
  SlugMappingEntrySchema,
  SlugMappingResponseSchema,
  // Types
  type LawSlug,
  type LawShortName,
  type LawSlugMapping,
  type LawWithCounts,
  type LawResolved,
  type LawInfo,
  type GetLawsWithCountsResponse,
  type SlugMappingEntry,
  type SlugMappingResponse,
  type SlugMappingCache,
  // Constants
  SLUG_CACHE_TTL_MS,
  SLUG_CACHE_MAX_AGE_MS,
} from './schemas'

// Queries
export {
  // Resolución de leyes (API principal)
  resolveLawBySlug,
  getLawInfoBySlug,
  getCanonicalSlugAsync,
  // Slug mapping
  getShortNameBySlug,
  getSlugByShortName,
  generateSlugFromShortName,
  getAllActiveSlugs,
  getSlugMappingForApi,
  // Normalización
  normalizeLawShortName,
  // Cache management
  invalidateSlugCache,
  loadSlugMappingCache,
  // Laws with counts
  getLawsWithQuestionCounts,
  getLawsBasic,
} from './queries'

// Cache warming (Supabase-based, para fetchers que no pueden usar Drizzle):
// import { warmSlugCache } from '@/lib/api/laws/warmCache'
// No se re-exporta aquí para evitar incluir Supabase en imports que solo necesitan tipos.
