// lib/api/scope-verification/queries.ts
// Datos del badge de verificación de topic_scope (ver docs/runbooks/verificar-epigrafes-scope.md).
// El badge cuenta temas PENDIENTES: never_verified (nuevos / nunca analizados),
// stale (scope/epígrafe cambió tras verificar) o verified_issues (revisión).
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export type ScopeVerificationCount =
  | { success: true; count: number }
  | { success: false; error: string }

export async function getScopeVerificationCount(): Promise<ScopeVerificationCount> {
  try {
    const db = getDb()
    const rows = (await db.execute(sql`
      SELECT count(*)::int AS c
      FROM topics t
      LEFT JOIN topic_scope_verification v ON v.topic_id = t.id
      WHERE t.is_active
        AND coalesce(v.state, 'never_verified') IN ('never_verified', 'stale', 'verified_issues')
    `)) as unknown as Array<{ c: number }>
    return { success: true, count: Number(rows?.[0]?.c ?? 0) }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
