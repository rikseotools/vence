// lib/cache/test-config.ts
// Invalidación del cache server-side de los endpoints test-config (Fase 4).
//
// Endpoints cacheados (lib/api/test-config/queries.ts):
//   - getScopedLawSectionsCached    (TTL 6h)
//   - getArticlesForLawCached       (TTL 6h)
//   - getEssentialArticlesCached    (TTL 24h)
// Todos comparten el tag 'test-config' para simplificar — cualquier mutación
// que afecte a counts/lista de articles invalida los 3 a la vez. La pérdida
// de granularidad es aceptable porque las mutaciones son raras (admin manual
// + cron BOE diario) y los 3 endpoints recargan rápido por la singleflight
// de Phase 2 que evita la tormenta tras el revalidate.
//
// Llamadores:
//   - app/api/admin/questions/lifecycle/transition/route.ts (lifecycle → is_active)
//   - app/api/admin/lifecycle/apply-fix/route.ts            (lifecycle transition tras content fix)
//   - app/api/admin/lifecycle/apply-fix-bulk/route.ts       (idem, batch)
//
// NO llaman (decisión consciente — no afectan los counts/listas cacheados):
//   - lib/api/verify-articles/queries.ts:updateQuestion: solo escribe
//     correctOption / explanation / verifiedAt / verificationStatus, ninguno
//     afecta is_active ni la pertenencia a topic_scope.
//   - dispute resolution: no muta `questions` (solo question_disputes).
//   - generate-explanation: solo cambia `explanation`.
//   - cron recalc-question-difficulty: muta `difficulty`, no is_active.
//   - article-sync (BOE cron): cambia articles/laws — afectaría sections y
//     essential-articles si renombra artículos; aceptado el lag del TTL
//     porque BOE cron corre diariamente y la diferencia es menor que el TTL.

import { revalidateTag } from 'next/cache'

export function invalidateTestConfigCache(): void {
  try {
    // Segundo arg 'max' incluye SWR variants. Coherente con
    // lib/cache/questions.ts y lib/api/profile/queries.ts.
    ;(revalidateTag as (tag: string, mode?: string) => void)('test-config', 'max')
  } catch (err) {
    console.warn('[invalidateTestConfigCache] revalidateTag failed (non-critical):', err)
  }
}
