// lib/api/scope-verification/queries.ts
// Datos del badge de verificación de CONTENIDO (ver docs/runbooks/verificar-epigrafes-scope.md).
// Suma los dos sistemas:
//   S1 scope   → topic_scope_verification: never_verified / stale / verified_issues
//   S2 epígrafe→ topic_epigrafe_verification_effective: distinto de verified_literal
// El badge cuenta TEMAS DISTINTOS que necesitan verificación por cualquiera de los dos.
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export type ScopeVerificationCount =
  | { success: true; count: number; scope: number; epigrafe: number }
  | { success: false; error: string }

export async function getScopeVerificationCount(): Promise<ScopeVerificationCount> {
  try {
    const db = getDb()
    const rows = (await db.execute(sql`
      SELECT
        count(*) FILTER (
          WHERE coalesce(sv.state, 'never_verified') IN ('never_verified', 'stale', 'verified_issues', 'needs_human')
             OR coalesce(ev.effective_state, 'never_sourced') <> 'verified_literal'
        )::int AS count,
        count(*) FILTER (
          WHERE coalesce(sv.state, 'never_verified') IN ('never_verified', 'stale', 'verified_issues', 'needs_human')
        )::int AS scope,
        count(*) FILTER (
          WHERE coalesce(ev.effective_state, 'never_sourced') <> 'verified_literal'
        )::int AS epigrafe
      FROM topics t
      LEFT JOIN topic_scope_verification sv ON sv.topic_id = t.id
      LEFT JOIN topic_epigrafe_verification_effective ev ON ev.topic_id = t.id
      WHERE t.is_active
    `)) as unknown as Array<{ count: number; scope: number; epigrafe: number }>
    const r = rows?.[0]
    return {
      success: true,
      count: Number(r?.count ?? 0),
      scope: Number(r?.scope ?? 0),
      epigrafe: Number(r?.epigrafe ?? 0),
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
