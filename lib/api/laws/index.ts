// lib/api/laws/index.ts - Exportaciones del módulo de leyes

// Schemas y tipos
export {
  // Schemas
  lawSlugSchema,
  lawShortNameSchema,
  LawSlugMappingSchema,
  LawWithCountsSchema,
  GetLawsWithCountsResponseSchema,
  // Types
  type LawSlug,
  type LawShortName,
  type LawSlugMapping,
  type LawWithCounts,
  type GetLawsWithCountsResponse,
  type SlugMappingCache,
  // Constants
  SLUG_CACHE_TTL_MS,
  SLUG_CACHE_MAX_AGE_MS,
} from './schemas'

// Queries
export {
  // Slug mapping (nuevo)
  getShortNameBySlug,
  getSlugByShortName,
  generateSlugFromShortName,
  invalidateSlugCache,
  // Laws with counts
  getLawsWithQuestionCounts,
  getLawsBasic,
} from './queries'
