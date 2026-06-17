// lib/api/oep-signals/sources.ts
// Queries y schemas para detection_sources (capa 1: fuentes regionales)
import { getDb } from '@/db/client'
import { detectionSources } from '@/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { z } from 'zod/v3'

// ============================================
// SCHEMAS
// ============================================

export const sourceTypeOptions = ['estado', 'ccaa', 'ayuntamiento', 'diputacion', 'universidad'] as const
export type SourceType = typeof sourceTypeOptions[number]

export const detectionSourceSchema = z.object({
  id: z.string().uuid(),
  sourceType: z.enum(sourceTypeOptions),
  regionName: z.string(),
  boletinName: z.string().nullable(),
  listingUrl: z.string().url(),
  searchKeywords: z.array(z.string()).nullable(),
  positionGroups: z.array(z.string()).nullable(),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  lastChecked: z.string().nullable(),
  lastHash: z.string().nullable(),
  lastSuccessAt: z.string().nullable(),
  lastError: z.string().nullable(),
})
export type DetectionSource = z.infer<typeof detectionSourceSchema>

// ============================================
// QUERIES
// ============================================

export async function getActiveSources(): Promise<DetectionSource[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(detectionSources)
    .where(eq(detectionSources.isActive, true))
    .orderBy(detectionSources.sourceType, detectionSources.regionName)
  return rows as DetectionSource[]
}

export async function listAllSources(): Promise<DetectionSource[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(detectionSources)
    .orderBy(detectionSources.sourceType, detectionSources.regionName)
  return rows as DetectionSource[]
}

export async function updateSourceCheckResult(params: {
  sourceId: string
  newHash: string | null
  error: string | null
}): Promise<void> {
  const db = getDb()
  const now = new Date().toISOString()
  await db
    .update(detectionSources)
    .set({
      lastChecked: now,
      lastHash: params.newHash ?? undefined,
      lastSuccessAt: params.error ? undefined : now,
      lastError: params.error,
      updatedAt: now,
    })
    .where(eq(detectionSources.id, params.sourceId))
}

export async function upsertSource(input: {
  sourceType: SourceType
  regionName: string
  boletinName?: string | null
  listingUrl: string
  searchKeywords?: string[]
  positionGroups?: string[]
  notes?: string | null
}): Promise<{ inserted: boolean; id: string }> {
  const db = getDb()
  const result = await db
    .insert(detectionSources)
    .values({
      sourceType: input.sourceType,
      regionName: input.regionName,
      boletinName: input.boletinName ?? null,
      listingUrl: input.listingUrl,
      searchKeywords: input.searchKeywords ?? ['auxiliar administrativo', 'administrativo', 'oposicion', 'convocatoria', 'C1', 'C2'],
      positionGroups: input.positionGroups ?? ['C1', 'C2'],
      notes: input.notes ?? null,
    })
    .onConflictDoNothing({ target: detectionSources.listingUrl })
    .returning({ id: detectionSources.id })

  if (result.length === 0) {
    // Ya existía - obtener id
    const existing = await db
      .select({ id: detectionSources.id })
      .from(detectionSources)
      .where(eq(detectionSources.listingUrl, input.listingUrl))
      .limit(1)
    return { inserted: false, id: existing[0]?.id ?? '' }
  }
  return { inserted: true, id: result[0].id }
}
