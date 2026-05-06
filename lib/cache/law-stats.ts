// lib/cache/law-stats.ts
// Invalidación del cache de queryLawStatsCached (Phase 4c).
//
// El endpoint /api/questions/law-stats devuelve counts de preguntas activas
// por ley. Como questions.is_active es GENERATED desde lifecycle_state,
// cualquier cambio de lifecycle puede modificar los counts.
//
// Llamadores (mismos 3 sitios que test-config — son los mismos triggers):
//   - app/api/admin/questions/lifecycle/transition/route.ts
//   - app/api/admin/lifecycle/apply-fix/route.ts
//   - app/api/admin/lifecycle/apply-fix-bulk/route.ts
//
// NO invalidan (no afectan los counts):
//   - dispute resolution
//   - generate-explanation
//   - cron recalc-question-difficulty (escribe difficulty, no is_active)
//   - updateQuestion de verify-articles (escribe correctOption / explanation)

import { revalidateTag } from 'next/cache'

export function invalidateLawStatsCache(): void {
  try {
    ;(revalidateTag as (tag: string, mode?: string) => void)('law-stats', 'max')
  } catch (err) {
    console.warn('[invalidateLawStatsCache] revalidateTag failed (non-critical):', err)
  }
}
