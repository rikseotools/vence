// lib/cache/verify-stats.ts
// Invalidación del cache de getAllLawsWithVerificationCached (Phase 4d).
//
// Endpoint /api/verify-articles/stats-by-law (admin-only) devuelve el
// estado de verificación BOE por ley: lastChecked, status,
// lastVerificationSummary. Datos cambian cuando admin ejecuta la
// verificación de una ley.
//
// Llamador único:
//   - lib/api/verify-articles/queries.ts:updateLawVerification
//     (se invoca desde app/api/verify-articles/route.ts en 2 sitios y
//     potencialmente desde scripts; la invalidación está dentro de la
//     función para cubrir todos los callers automáticamente.)
//
// Para purga manual desde scripts (que NO pasan por Next runtime):
//   curl -X POST -H "x-cron-secret: $CRON_SECRET" \
//     -H "Content-Type: application/json" \
//     -d '{"tag":"verify-stats"}' \
//     https://www.vence.es/api/admin/revalidate

import { revalidateTag } from 'next/cache'

export function invalidateVerifyStatsCache(): void {
  try {
    ;(revalidateTag as (tag: string, mode?: string) => void)('verify-stats', 'max')
  } catch (err) {
    console.warn('[invalidateVerifyStatsCache] revalidateTag failed (non-critical):', err)
  }
}
