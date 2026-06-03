import { eq, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../db/database.module';
import { seoKeywordTargets, seoKeywordSnapshots } from './seo-snapshot.schema';

export interface SnapshotRow {
  keyword: string;
  capturedOn: string; // YYYY-MM-DD
  position: string | null;
  impressions: number;
  clicks: number;
  ctr: string | null;
}

/** Keywords objetivo activas a snapshotear. */
export async function getActiveTargetKeywords(db: DrizzleDB): Promise<string[]> {
  const rows = await db
    .select({ keyword: seoKeywordTargets.keyword })
    .from(seoKeywordTargets)
    .where(eq(seoKeywordTargets.isActive, true));
  return rows.map((r) => r.keyword);
}

/**
 * Upsert idempotente de snapshots (1 por keyword y día). ON CONFLICT
 * (keyword, captured_on) actualiza a los valores nuevos (re-ejecutable).
 */
export async function upsertSnapshots(db: DrizzleDB, rows: SnapshotRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db
    .insert(seoKeywordSnapshots)
    .values(rows.map((r) => ({ ...r, source: 'gsc' })))
    .onConflictDoUpdate({
      target: [seoKeywordSnapshots.keyword, seoKeywordSnapshots.capturedOn],
      set: {
        position: sql`excluded.position`,
        impressions: sql`excluded.impressions`,
        clicks: sql`excluded.clicks`,
        ctr: sql`excluded.ctr`,
      },
    });
}
