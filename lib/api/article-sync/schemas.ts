// lib/api/article-sync/schemas.ts - Schemas de validación para sincronización de artículos
import { z } from 'zod/v3'

// ============================================
// CONSTANTES
// ============================================

// Artículos de estructura que mantenemos en BD pero no existen en BOE
// Ejemplo: "0" para estructura general de la ley
export const STRUCTURE_ARTICLE_PATTERNS = ['0', '0.', 'estructura', 'índice'] as const

export function isStructureArticle(articleNumber: string): boolean {
  const normalized = articleNumber.toLowerCase().trim()
  return STRUCTURE_ARTICLE_PATTERNS.some(pattern =>
    normalized === pattern || normalized.startsWith('0.')
  )
}

// ============================================
// REQUEST: SYNC ARTICLES
// ============================================

export const syncArticlesRequestSchema = z.object({
  lawId: z.string().uuid('lawId debe ser un UUID válido'),
  mode: z.enum(['sync', 'replace']).default('sync'),
})

export type SyncArticlesRequest = z.infer<typeof syncArticlesRequestSchema>

// ============================================
// RESPONSE: SYNC STATS
// ============================================

export const syncStatsSchema = z.object({
  boeTotal: z.number(),
  dbTotal: z.number(),
  added: z.number(),
  updated: z.number(),
  deactivated: z.number(),
  unchanged: z.number(),
  structureArticles: z.number(), // Artículos de estructura (no en BOE)
  noConsolidatedText: z.boolean().optional(),
})

export type SyncStats = z.infer<typeof syncStatsSchema>

// ============================================
// RESPONSE: SYNC ARTICLES
// ============================================

export const syncArticlesResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  stats: syncStatsSchema.optional(),
  error: z.string().optional(),
})

export type SyncArticlesResponse = z.infer<typeof syncArticlesResponseSchema>

// ============================================
// VERIFICATION SUMMARY (para guardar en laws.last_verification_summary)
// ============================================

export const verificationSummarySchema = z.object({
  boe_count: z.number(),
  db_count: z.number(),
  matching: z.number(),
  title_mismatch: z.number(),
  content_mismatch: z.number(),
  extra_in_db: z.number(),
  missing_in_db: z.number(),
  structure_articles: z.number(), // Nuevos: artículos de estructura
  is_ok: z.boolean(),
  no_consolidated_text: z.boolean().optional(),
  verified_at: z.string(),
  message: z.string().optional(),
})

export type VerificationSummary = z.infer<typeof verificationSummarySchema>

// ============================================
// VALIDADORES
// ============================================

export function safeParseRequest(data: unknown) {
  return syncArticlesRequestSchema.safeParse(data)
}

export function validateRequest(data: unknown): SyncArticlesRequest {
  return syncArticlesRequestSchema.parse(data)
}
