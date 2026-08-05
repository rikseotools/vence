// lib/api/scope-verification/queries.ts
// Datos del badge de verificación de CONTENIDO (ver docs/runbooks/verificar-epigrafes-scope.md).
// Suma los dos sistemas:
//   S1 scope   → topic_scope_verification: never_verified / stale / verified_issues
//                (T-518) + un `verified_correct` sellado FUERA del pipeline cuenta como pendiente
//   S2 epígrafe→ topic_epigrafe_verification_effective: distinto de verified_literal
// El badge cuenta TEMAS DISTINTOS que necesitan verificación por cualquiera de los dos.
import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'
// Único origen del criterio "¿este sellado viene del pipeline?" (ver `lib/temario/revisionEpigrafe.cjs`
// → `selladoFiable`), para no tener el escritor sin pipeline duplicado en JS y en SQL.
const { ESCRITORES_SIN_PIPELINE } = require('../../temario/revisionEpigrafe.cjs') as {
  ESCRITORES_SIN_PIPELINE: Set<string>
}

export type ScopeVerificationCount =
  | { success: true; count: number; scope: number; epigrafe: number; scopeSinPipeline: number }
  | { success: false; error: string }

export async function getScopeVerificationCount(): Promise<ScopeVerificationCount> {
  try {
    const db = getAdminDb() // pool admin (fix contención RDS 14/07): badge admin fuera del hot path
    const escritoresSql = sql.join(
      Array.from(ESCRITORES_SIN_PIPELINE).map((e) => sql`${e}`),
      sql`, `
    )
    // Falso verde del 20-21/07 (T-518): 711 temas en 45 oposiciones quedaron `verified_correct`
    // sellados en el mismo segundo por `claude_direct` con `agent_run_id='--run'` (el nombre del
    // flag, mal pasado como valor) — el pipeline de 2 agentes nunca corrió. El badge no puede
    // seguir tratando ese verde igual que uno que sí pasó por `verify:scope`.
    const selladoSinPipeline = sql`(
      sv.state = 'verified_correct' AND (
        sv.verified_by IN (${escritoresSql})
        OR btrim(coalesce(sv.agent_run_id, '')) = ''
        OR sv.agent_run_id LIKE '--%'
      )
    )`
    const rows = (await db.execute(sql`
      SELECT
        count(*) FILTER (
          WHERE coalesce(sv.state, 'never_verified') IN ('never_verified', 'stale', 'verified_issues', 'needs_human')
             OR coalesce(ev.effective_state, 'never_sourced') <> 'verified_literal'
             OR ${selladoSinPipeline}
        )::int AS count,
        count(*) FILTER (
          WHERE coalesce(sv.state, 'never_verified') IN ('never_verified', 'stale', 'verified_issues', 'needs_human')
             OR ${selladoSinPipeline}
        )::int AS scope,
        count(*) FILTER (
          WHERE coalesce(ev.effective_state, 'never_sourced') <> 'verified_literal'
        )::int AS epigrafe,
        count(*) FILTER (WHERE ${selladoSinPipeline})::int AS scope_sin_pipeline
      FROM topics t
      LEFT JOIN topic_scope_verification sv ON sv.topic_id = t.id
      LEFT JOIN topic_epigrafe_verification_effective ev ON ev.topic_id = t.id
      WHERE t.is_active
    `)) as unknown as Array<{ count: number; scope: number; epigrafe: number; scope_sin_pipeline: number }>
    const r = rows?.[0]
    return {
      success: true,
      count: Number(r?.count ?? 0),
      scope: Number(r?.scope ?? 0),
      epigrafe: Number(r?.epigrafe ?? 0),
      scopeSinPipeline: Number(r?.scope_sin_pipeline ?? 0),
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error' }
  }
}
