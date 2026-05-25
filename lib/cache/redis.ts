// lib/cache/redis.ts
// Cache server-side compartido con Upstash Redis (Fase 1 del roadmap).
// Patrón: cache-aside con fallback graceful a BD si Redis falla.
//
// Uso típico:
//   const stats = await getOrSet(`user_stats:${userId}`, 30, () => fetchFromDb())
//
// Si Redis está caído o lento, NO bloquea la app: cae directo a fetcher (BD).
// Esto preserva la disponibilidad. La latencia añadida en caso de fallo es
// como máximo REDIS_TIMEOUT_MS (100ms).
//
// Feature flag REDIS_CACHE_ENABLED:
// - Si !== 'true' → bypass total, ir siempre a fetcher (rollback instantáneo).
// - Por defecto activado en producción.

import { Redis } from '@upstash/redis'

// Timeout estricto: si Redis no responde en 100ms, ir a BD.
// 100ms es 10x lo que tarda un GET normal, suficiente margen para latencia
// de red puntual sin penalizar la request del usuario.
const REDIS_TIMEOUT_MS = 100

let _redis: Redis | null = null
function getRedis(): Redis | null {
  if (process.env.REDIS_CACHE_ENABLED === 'false') return null
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

/**
 * Race una promesa contra un timeout. Si supera ms, resuelve con symbol único
 * que el caller puede detectar (mejor que throw que sería ambiguo con errores reales).
 */
const TIMEOUT_SYMBOL = Symbol('redis_timeout')
async function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMEOUT_SYMBOL> {
  const timeout = new Promise<typeof TIMEOUT_SYMBOL>(resolve =>
    setTimeout(() => resolve(TIMEOUT_SYMBOL), ms),
  )
  return Promise.race([p, timeout])
}

// ============================================
// SINGLEFLIGHT — deduplica fetchers in-flight
// ============================================
// Cuando una key caliente expira y N requests concurrentes hacen miss
// simultáneamente, sin singleflight las N llamarían al fetcher (BD) → tormenta.
// Con singleflight: la primera lanza el fetcher y guarda la Promise en este
// Map; las N-1 siguientes encuentran la Promise existente y await sobre ella.
// Resultado: 1 query a BD en vez de N por expiración.
//
// Map module-scoped → un slot por key por instancia serverless (cold start
// resetea, lo cual es correcto). Cleanup en finally garantiza que ni éxitos
// ni excepciones dejan entradas zombi.
//
// Nota: hay una ventana microscópica entre fetcher.resolve y redis.set landing
// donde una request entrante podría no encontrar entrada inflight ni cache
// fresh y disparar otro fetcher. Es aceptable (microsegundos) y resolverlo
// requeriría hacer redis.set bloqueante, perdiendo la latencia ganada.
const inflight = new Map<string, Promise<unknown>>()

// ============================================
// MÉTRICAS — hit/miss por prefijo (Phase 6 obs)
// ============================================
// Sin telemetría no podemos saber si el cache está sirviendo lo que
// esperábamos. Cada hit/miss hace HINCRBY fire-and-forget en Redis sobre
// la clave 'cache_metrics' bajo el campo `${prefix}:hit` o `:miss`.
// Para verlo: GET /api/admin/health/cache-stats.
//
// Feature flag: CACHE_METRICS_ENABLED=false → desactiva los HINCRBY.
// Coste: ~1 op Redis extra por cache access. A 1k ops/s totales,
// añade 200ms de Upstash bandwidth en pico, despreciable.

const METRICS_HASH_KEY = 'cache_metrics'

function metricsEnabled(): boolean {
  return process.env.CACHE_METRICS_ENABLED !== 'false'
}

function metricPrefix(cacheKey: string): string {
  // El convenio del repo es prefix:userId / prefix:userId:variant.
  // Para agrupar por endpoint, tomamos hasta el primer ':'.
  const idx = cacheKey.indexOf(':')
  return idx === -1 ? cacheKey : cacheKey.slice(0, idx)
}

function recordCacheEvent(redis: Redis, key: string, kind: 'hit' | 'miss'): void {
  if (!metricsEnabled()) return
  const field = `${metricPrefix(key)}:${kind}`
  // Fire-and-forget. Si Upstash falla, el cache funcional no se afecta.
  redis.hincrby(METRICS_HASH_KEY, field, 1).catch(() => {})
}

/**
 * Lee el snapshot actual de hits/misses por prefijo.
 * Devuelve un Map { 'user_stats:hit': 1234, 'user_stats:miss': 56, ... }.
 * Usa raceTimeout — si Redis tarda, devuelve {} (no es crítico).
 */
export async function getCacheMetrics(): Promise<Record<string, number>> {
  const redis = getRedis()
  if (!redis) return {}
  try {
    const result = await raceTimeout(
      redis.hgetall<Record<string, string | number>>(METRICS_HASH_KEY),
      REDIS_TIMEOUT_MS,
    )
    if (result === TIMEOUT_SYMBOL || !result) return {}
    // Upstash devuelve string a veces, number otras — normalizar
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(result)) {
      out[k] = typeof v === 'number' ? v : parseInt(String(v), 10) || 0
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Resetea contadores de cache_metrics. Solo para uso de operaciones
 * (deploy, debug). Best-effort.
 */
export async function resetCacheMetrics(): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await raceTimeout(redis.del(METRICS_HASH_KEY), REDIS_TIMEOUT_MS)
  } catch { /* idem */ }
}

/**
 * Cache-aside pattern con singleflight. Si hay cache hit, devuelve. Si miss
 * o Redis falla, llama fetcher (deduplicado por key entre requests
 * concurrentes) y guarda el resultado (best-effort, sin bloquear).
 *
 * @param key Clave única (incluir tipo + userId/identificador)
 * @param ttlSeconds TTL en segundos
 * @param fetcher Función que produce el valor desde la fuente real (BD).
 *                DEBE ser idempotente — singleflight comparte el resultado
 *                entre N requests concurrentes con la misma key.
 * @returns El valor cacheado o recién obtenido
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const redis = getRedis()

  // Sin Redis: ir directo a fetcher (preserva disponibilidad).
  // No aplicamos singleflight tampoco — sin cache no hay tormenta de "expiración"
  // que prevenir, y añadirlo cambiaría la semántica esperada por callers que
  // hayan asumido que sin Redis cada request hace su propia query.
  if (!redis) {
    return fetcher()
  }

  // 1. Intentar GET con timeout estricto
  try {
    const cached = await raceTimeout(redis.get<T>(key), REDIS_TIMEOUT_MS)
    if (cached !== TIMEOUT_SYMBOL && cached !== null && cached !== undefined) {
      recordCacheEvent(redis, key, 'hit')
      return cached
    }
    // Si timeout o miss, seguir a fetcher
  } catch {
    // Error de Redis (network, parse) → fetcher
  }

  // 2. Singleflight: si ya hay un fetcher in-flight para esta key, esperar
  // a que termine y reutilizar su resultado (o su error).
  // Nota: contamos esto como hit porque el caller no toca BD —
  // se reutiliza el resultado del fetcher in-flight.
  const existing = inflight.get(key)
  if (existing) {
    recordCacheEvent(redis, key, 'hit')
    return existing as Promise<T>
  }

  // 3. Cache miss y sin in-flight → lanzar fetcher, almacenar Promise
  recordCacheEvent(redis, key, 'miss')
  const promise = (async () => {
    try {
      const value = await fetcher()
      // SET cache fire-and-forget (preserve la latencia ganada)
      redis.set(key, value, { ex: ttlSeconds }).catch(() => {
        // Silently ignore - el fetcher ya devolvió el valor correcto
      })
      return value
    } finally {
      // Cleanup garantizado: si el fetcher resuelve o rechaza, la entrada
      // se libera para que la siguiente request pueda reintentar (en caso
      // de error) o ver el cache fresco (en caso de éxito).
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}

/**
 * Test-only helper para inspeccionar/limpiar el Map de singleflight.
 * No debe usarse en código de producción.
 */
export function _singleflightInternalForTests() {
  return {
    size: () => inflight.size,
    has: (key: string) => inflight.has(key),
    clear: () => inflight.clear(),
  }
}

/**
 * GET con timeout estricto y fallback graceful. Devuelve null si miss,
 * timeout o Redis caído. Útil para patrones donde el caller quiere control
 * fino sobre fresh/stale (p.ej. servir cache stale en caso de timeout BD).
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const cached = await raceTimeout(redis.get<T>(key), REDIS_TIMEOUT_MS)
    if (cached !== TIMEOUT_SYMBOL && cached !== null && cached !== undefined) {
      return cached
    }
  } catch {
    // Network / parse error → tratar como miss
  }
  return null
}

/**
 * SET fire-and-forget con TTL. No espera la confirmación de Redis: si falla,
 * la próxima request será otro miss (aceptable). Sin bloquear la respuesta.
 */
export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  redis.set(key, value, { ex: ttlSeconds }).catch(() => {
    // Silently ignore - el caller ya tiene el valor correcto
  })
}

/**
 * Invalidar una clave (DELETE). Best-effort, no bloquea si falla.
 * Útil tras UPDATE en BD para forzar refresh en próxima lectura.
 */
export async function invalidate(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try {
    await raceTimeout(redis.del(key), REDIS_TIMEOUT_MS)
  } catch {
    // Si falla la invalidación, el TTL eventualmente limpiará el valor stale
  }
}

/**
 * Invalidar múltiples claves de un patrón. Best-effort.
 * Para Upstash Redis sin SCAN soportado, mejor invalidar por claves explícitas.
 */
export async function invalidateMany(keys: string[]): Promise<void> {
  const redis = getRedis()
  if (!redis || keys.length === 0) return
  try {
    await raceTimeout(redis.del(...keys), REDIS_TIMEOUT_MS)
  } catch {
    // Idem
  }
}

/**
 * INCR atómico — devuelve el nuevo valor tras incrementar (1 si no existía).
 *
 * Operación nativa de Redis/Memcached/DynamoDB/etcd → agnóstica a proveedor.
 * Usada para implementar el patrón de cache versionado tag-like: cada INCR
 * de `cache_version:${tag}` invalida atómicamente todas las cache keys que
 * incluyan la versión anterior. Sin SCAN, sin Lua scripts.
 *
 * Cross-runtime coherente: la misma key en Upstash es vista igual por
 * Vercel (esta función) y por el backend NestJS (`CacheVersioningService`).
 */
export async function incrementCounter(key: string): Promise<number> {
  const redis = getRedis()
  if (!redis) return 0
  try {
    const result = await raceTimeout(redis.incr(key), REDIS_TIMEOUT_MS)
    if (result === TIMEOUT_SYMBOL) return 0
    return typeof result === 'number' ? result : Number(result) || 0
  } catch (err) {
    console.warn(`[incrementCounter] INCR ${key} failed:`, err)
    return 0
  }
}
