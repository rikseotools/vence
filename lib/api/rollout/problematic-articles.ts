// lib/api/rollout/problematic-articles.ts
// Canary rollout para el endpoint nuevo getUserProblematicArticlesWeekly
// (FASE 5 refactor oposicion-scope).
//
// Cómo funciona:
//   hash(userId) % 100 < PCT → nuevo path (Drizzle + scope)
//   resto                    → RPC vieja
//
// Mismo userId siempre cae del mismo lado. Rollback: bajar PCT a 0 en Vercel.
// Ver docs/maintenance/despliegue-articulos-problematicos.md para el runbook.

/**
 * djb2 hash determinista. No es criptográfico — solo sirve para repartir
 * usuarios de forma estable entre buckets 0-99.
 */
function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Lee el % de rollout desde env. Usa la misma var en cliente y server
 * (NEXT_PUBLIC_ se inlinea en el bundle del cliente en build time).
 * Cap a [0, 100]. Valor inválido → 0 (conservador: path viejo).
 */
export function getProblematicArticlesRolloutPct(): number {
  const raw = process.env.NEXT_PUBLIC_PROBLEMATIC_ARTICLES_ROLLOUT_PCT
  if (!raw) return 0
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 100) return 100
  return n
}

/**
 * Devuelve true si el usuario cae en el bucket del path nuevo.
 */
export function isInProblematicArticlesRollout(userId: string, pct?: number): boolean {
  const effectivePct = pct ?? getProblematicArticlesRolloutPct()
  if (!userId) return false
  if (effectivePct >= 100) return true
  if (effectivePct <= 0) return false
  return hash(userId) % 100 < effectivePct
}
