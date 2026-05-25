// lib/api/backend-router.ts
//
// Helper único para decidir si una request va al backend dedicado
// (NestJS/Fargate en api.vence.es) o se queda en Vercel.
//
// Patrón: feature flag hardcoded por endpoint. Cambiar el flag a true =
// activar el canary; cambiar a false = rollback. Ambos son commits de 1
// línea — git revert siempre nos saca.
//
// Por qué hardcoded y no env var: el patrón equivalente (USE_READ_REPLICA
// con fallback automático en db/client.ts) demostró que un flag versionado
// en git es más auditable y revertible que tocar Vercel UI a mano. Cuando
// queramos rollback urgente, basta con un commit que cambie `true`→`false`
// (o git revert) y Vercel auto-deploy aplica en ~2 min.
//
// Doc decisión: docs/architecture/bloque3-backend-url-pattern.md

/**
 * URL del backend NestJS expuesto vía ALB + ACM. Hardcoded porque NO es
 * secreto (el ALB está expuesto a internet en todo caso).
 */
const BACKEND_URL = 'https://api.vence.es'

/**
 * Endpoints candidatos a proxy al backend. Cada uno tiene su propio flag
 * para activación independiente. Empezar todos en `false`.
 */
const FLAGS = {
  // Activado 2026-05-24 — canary medals. Backend api.vence.es/api/medals
  // verificado funcionando con paridad JSON 100% vs Vercel + latencia
  // mejor (178ms vs 251ms). Rollback = cambiar a false y push.
  medals: true,
  // answer-and-save — KEYSTONE del Bloque 3 (audit: 222 errors/7d, 3
  // cascades, arrastra 8 endpoints). Backend NestJS deployado y
  // smoke-tested 2026-05-24. ACTIVADO mismo día tras paridad verificada
  // (JwtGuard + Zod + antifraud RPC register_device funcional + mapeo
  // status). Rollback = cambiar a false y push.
  'answer-and-save': true,
  // daily-limit — Bloque 3 endpoint #3 (2026-05-25). Las 3 RPCs ya
  // estaban portadas como SQL puro en el módulo de answer-and-save
  // (commit 65868583). Solo añadimos Controller GET con JwtGuard +
  // cache stale-while-error (misma key Upstash `daily_limit:${userId}`
  // que Vercel, cross-runtime coherente). Flag OFF inicial → activar
  // tras smoke verde. Rollback = cambiar a false y push.
  'daily-limit': false,
  // Próximos candidatos según docs/architecture/bloque3-audit-hot-path.md:
  // 'test-config':     false,
  // 'stats':           false,
} as const

export type BackendEndpoint = keyof typeof FLAGS

/**
 * ¿Debemos rutear este endpoint al backend dedicado?
 * Devuelve `false` si BACKEND_URL no está configurado (defensa contra
 * deploys con env mal).
 */
export function shouldRouteToBackend(endpoint: BackendEndpoint): boolean {
  return Boolean(BACKEND_URL) && FLAGS[endpoint]
}

/**
 * Construye la URL completa al backend para un path dado.
 *
 * @example
 *   backendUrlFor('api/medals?userId=abc') → 'https://api.vence.es/api/medals?userId=abc'
 */
export function backendUrlFor(path: string): string {
  return `${BACKEND_URL}/${path.replace(/^\/+/, '')}`
}

/**
 * Helper para tests: devuelve el estado actual de un flag (sólo para
 * verificar regresiones, no usar en código de producción).
 */
export function _isFlagEnabledForTests(endpoint: BackendEndpoint): boolean {
  return FLAGS[endpoint]
}
