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
import { incrementCounter } from '@/lib/cache/redis'

/**
 * Invalida el cache de los endpoints test-config en DOS planos:
 *
 * 1. `revalidateTag('test-config')` — invalida el `unstable_cache` de
 *    Next.js (afecta solo a procesos Vercel que sirven aún el endpoint
 *    Vercel local del flag canary).
 *
 * 2. **INCR `cache_version:test-config` en Upstash** — invalida la
 *    cache versionada del backend NestJS/Fargate (Bloque 3 canary).
 *    Patrón "versioned cache keys": el backend construye sus cache
 *    keys como `test-config:v${currentVersion}:...`. Al INCR, las
 *    keys viejas dejan de ser leídas (ningún request las pide). El
 *    backend ve la nueva versión en ≤1s (TTL local del version cache).
 *
 * Cross-runtime coherente: ambos planos se invalidan a la vez, da
 * igual si el endpoint vive en Vercel o Fargate en ese momento.
 *
 * Función sync (no `async`) para mantener compatible con los 3 callers
 * existentes que la invocan sin `await`. El INCR de Redis se lanza como
 * fire-and-forget interno — la latencia añadida al caller es cero.
 */
export function invalidateTestConfigCache(): void {
  // Plano 1: Vercel unstable_cache (sync)
  try {
    ;(revalidateTag as (tag: string, mode?: string) => void)('test-config', 'max')
  } catch (err) {
    console.warn('[invalidateTestConfigCache] revalidateTag failed (non-critical):', err)
  }

  // Plano 2: backend NestJS versioned cache. Misma instancia Upstash que
  // usa el backend (cross-runtime coherente). Fire-and-forget — incrementCounter
  // maneja fallback graceful si Redis cae (devuelve 0 sin throw).
  incrementCounter('cache_version:test-config').catch(() => {
    // Ya logueado en incrementCounter; mantener fire-and-forget
  })
}
