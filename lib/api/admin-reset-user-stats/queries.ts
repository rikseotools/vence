// lib/api/admin-reset-user-stats/queries.ts
//
// Reseteo de métricas de estudio CONSERVANDO la cuenta.
//
// El borrado lo hace la función SQL `public.reset_user_stats(...)`
// (migración 20260716_reset_user_stats_fn.sql) en UNA transacción server-side.
// Por qué en la BD y no ~20 DELETE desde aquí:
//
//   1. ORDEN: los triggers materializadores de test_questions tienen guard
//      `EXISTS user_profiles`. Como aquí el perfil SOBREVIVE, borrar las stats
//      antes que test_questions las REPUEBLA. El orden es parte del contrato.
//   2. ATOMICIDAD: N round-trips sin transacción sobre el pooler → 504 y estado
//      parcial (incidente 25/06, ver eliminacion-cuentas.md §6). Un parcial aquí
//      deja stats descuadradas respecto a los tests: peor que no tocar nada.
//   3. SNAPSHOT: la función archiva las filas en user_stats_resets antes de
//      borrarlas, en la misma transacción → o se archiva y se borra, o ninguna.
//
// AGNOSTICISMO: se invoca por Drizzle/getAdminDb(), nunca por supabase.rpc().

import { getAdminDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export type ResetUserStatsResult = {
  resetId: string | null
  deletedCounts: Record<string, number>
  totalRowsDeleted: number
}

/**
 * Ejecuta el reseteo. Lanza si el usuario no existe (la función SQL hace
 * RAISE no_data_found) — un userId inventado NO debe parecer un éxito con
 * "0 filas borradas".
 */
export async function resetUserStats(params: {
  userId: string
  requestedBy: string
  reason: string
  includeAnalytics?: boolean
}): Promise<ResetUserStatsResult> {
  const { userId, requestedBy, reason, includeAnalytics = false } = params

  const result = await getAdminDb().execute(
    sql`SELECT public.reset_user_stats(
          ${userId}::uuid,
          ${requestedBy}::text,
          ${reason}::text,
          ${includeAnalytics}::boolean
        ) AS payload`
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (result as any).rows ?? (result as any)
  const payload = (rows?.[0]?.payload ?? {}) as Record<string, unknown>

  // La función devuelve {tabla: n, ..., _reset_id: uuid}. Separamos el id de los
  // contadores para no colar '_reset_id' como si fuera una tabla.
  const resetId = typeof payload._reset_id === 'string' ? payload._reset_id : null
  const deletedCounts: Record<string, number> = {}
  for (const [key, value] of Object.entries(payload)) {
    if (key === '_reset_id') continue
    if (typeof value === 'number') deletedCounts[key] = value
  }

  const totalRowsDeleted = Object.values(deletedCounts).reduce((a, b) => a + b, 0)

  return { resetId, deletedCounts, totalRowsDeleted }
}
