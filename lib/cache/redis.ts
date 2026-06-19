// lib/cache/redis.ts
// Cache server-side compartido (Fase 1 del roadmap). Patrón: cache-aside con
// fallback graceful a BD si la caché falla.
//
// Uso típico:
//   const stats = await getOrSet(`user_stats:${userId}`, 30, () => fetchFromDb())
//
// Si la caché está caída o lenta, NO bloquea la app: cae directo a fetcher (BD).
// La latencia añadida en caso de fallo es como máximo REDIS_TIMEOUT_MS (100ms).
//
// AGNÓSTICO POR CONTRATO: toda la LÓGICA (timeout, singleflight, métricas,
// fallback) vive aquí y habla con la interfaz `CacheSink` (lib/cache/sink). El
// proveedor (Upstash REST hoy, ElastiCache TCP mañana) se elige por env
// `CACHE_PROVIDER` sin tocar ni esta lógica ni los callers.
//
// Feature flag REDIS_CACHE_ENABLED:
// - Si === 'false' → bypass total, ir siempre a fetcher (rollback instantáneo).
// - Por defecto activado en producción.

import { getSink, type CacheSink } from './sink'

// Timeout estricto: si la caché no responde en 100ms, ir a BD.
const REDIS_TIMEOUT_MS = 100

/**
 * Race una promesa contra un timeout. Si supera ms, resuelve con symbol único
 * que el caller puede detectar (mejor que throw, ambiguo con errores reales).
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
// Cuando una key caliente expira y N requests concurrentes hacen miss a la vez,
// sin singleflight las N llamarían al fetcher (BD) → tormenta. Con singleflight:
// la primera lanza el fetcher y guarda la Promise; las N-1 siguientes await sobre
// ella. Resultado: 1 query a BD en vez de N por expiración. Cleanup en finally.
const inflight = new Map<string, Promise<unknown>>()

// ============================================
// MÉTRICAS — hit/miss por prefijo (Phase 6 obs)
// ============================================
// Cada hit/miss hace HINCRBY fire-and-forget sobre la clave 'cache_metrics' bajo
// el campo `${prefix}:hit`/`:miss`. Verlo en GET /api/admin/health/cache-stats.
// Flag CACHE_METRICS_ENABLED=false → desactiva.

const METRICS_HASH_KEY = 'cache_metrics'

function metricsEnabled(): boolean {
  return process.env.CACHE_METRICS_ENABLED !== 'false'
}

function metricPrefix(cacheKey: string): string {
  const idx = cacheKey.indexOf(':')
  return idx === -1 ? cacheKey : cacheKey.slice(0, idx)
}

function recordCacheEvent(sink: CacheSink, key: string, kind: 'hit' | 'miss'): void {
  if (!metricsEnabled()) return
  const field = `${metricPrefix(key)}:${kind}`
  // Fire-and-forget. Si la caché falla, el cache funcional no se afecta.
  sink.hincrby(METRICS_HASH_KEY, field, 1).catch(() => {})
}

/**
 * Lee el snapshot actual de hits/misses por prefijo.
 * Usa raceTimeout — si la caché tarda, devuelve {} (no es crítico).
 */
export async function getCacheMetrics(): Promise<Record<string, number>> {
  const sink = getSink()
  if (!sink) return {}
  try {
    const result = await raceTimeout(sink.hgetall(METRICS_HASH_KEY), REDIS_TIMEOUT_MS)
    if (result === TIMEOUT_SYMBOL || !result) return {}
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(result)) {
      out[k] = typeof v === 'number' ? v : parseInt(String(v), 10) || 0
    }
    return out
  } catch {
    return {}
  }
}

/** Resetea contadores de cache_metrics. Operaciones/debug. Best-effort. */
export async function resetCacheMetrics(): Promise<void> {
  const sink = getSink()
  if (!sink) return
  try {
    await raceTimeout(sink.del([METRICS_HASH_KEY]), REDIS_TIMEOUT_MS)
  } catch { /* idem */ }
}

/**
 * Cache-aside con singleflight. Hit → devuelve. Miss o caché caída → fetcher
 * (deduplicado por key entre requests concurrentes) y guarda el resultado
 * (best-effort, sin bloquear).
 *
 * @param fetcher DEBE ser idempotente — singleflight comparte su resultado.
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const sink = getSink()

  // Sin caché: ir directo a fetcher (preserva disponibilidad). Sin singleflight
  // tampoco (sin cache no hay tormenta de expiración que prevenir).
  if (!sink) {
    return fetcher()
  }

  // 1. Intentar GET con timeout estricto
  try {
    const cached = await raceTimeout(sink.get<T>(key), REDIS_TIMEOUT_MS)
    if (cached !== TIMEOUT_SYMBOL && cached !== null && cached !== undefined) {
      recordCacheEvent(sink, key, 'hit')
      return cached
    }
  } catch {
    // Error de caché (network, parse) → fetcher
  }

  // 2. Singleflight: si ya hay un fetcher in-flight, reutilizar su resultado.
  const existing = inflight.get(key)
  if (existing) {
    recordCacheEvent(sink, key, 'hit')
    return existing as Promise<T>
  }

  // 3. Miss y sin in-flight → lanzar fetcher, almacenar Promise
  recordCacheEvent(sink, key, 'miss')
  const promise = (async () => {
    try {
      const value = await fetcher()
      // SET fire-and-forget (preserva la latencia ganada)
      sink.set(key, value, ttlSeconds).catch(() => {
        // Silently ignore - el fetcher ya devolvió el valor correcto
      })
      return value
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}

/** Test-only helper para inspeccionar/limpiar el Map de singleflight. */
export function _singleflightInternalForTests() {
  return {
    size: () => inflight.size,
    has: (key: string) => inflight.has(key),
    clear: () => inflight.clear(),
  }
}

/**
 * GET con timeout estricto y fallback graceful. Devuelve null si miss, timeout
 * o caché caída. Para patrones donde el caller quiere control fresh/stale.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  const sink = getSink()
  if (!sink) return null
  try {
    const cached = await raceTimeout(sink.get<T>(key), REDIS_TIMEOUT_MS)
    if (cached !== TIMEOUT_SYMBOL && cached !== null && cached !== undefined) {
      return cached
    }
  } catch {
    // Network / parse error → tratar como miss
  }
  return null
}

/**
 * SET fire-and-forget con TTL. No espera confirmación: si falla, la próxima
 * request será otro miss (aceptable). Sin bloquear la respuesta.
 */
export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const sink = getSink()
  if (!sink) return
  sink.set(key, value, ttlSeconds).catch(() => {
    // Silently ignore - el caller ya tiene el valor correcto
  })
}

/**
 * Invalidar una clave (DELETE). Best-effort, no bloquea si falla.
 * Útil tras UPDATE en BD para forzar refresh en próxima lectura.
 */
export async function invalidate(key: string): Promise<void> {
  const sink = getSink()
  if (!sink) return
  try {
    await raceTimeout(sink.del([key]), REDIS_TIMEOUT_MS)
  } catch {
    // Si falla, el TTL eventualmente limpiará el valor stale
  }
}

/** Invalidar múltiples claves explícitas. Best-effort. */
export async function invalidateMany(keys: string[]): Promise<void> {
  const sink = getSink()
  if (!sink || keys.length === 0) return
  try {
    await raceTimeout(sink.del(keys), REDIS_TIMEOUT_MS)
  } catch {
    // Idem
  }
}

/**
 * INCR atómico — devuelve el nuevo valor (1 si no existía). Op nativa de
 * Redis/Memcached/DynamoDB → agnóstica. Para cache versionado tag-like.
 */
export async function incrementCounter(key: string): Promise<number> {
  const sink = getSink()
  if (!sink) return 0
  try {
    const result = await raceTimeout(sink.incr(key), REDIS_TIMEOUT_MS)
    if (result === TIMEOUT_SYMBOL) return 0
    return typeof result === 'number' ? result : Number(result) || 0
  } catch (err) {
    console.warn(`[incrementCounter] INCR ${key} failed:`, err)
    return 0
  }
}

/**
 * INCRBY atómico + EXPIRE — contador con ventana temporal (cuota diaria, rate
 * window). Devuelve el nuevo total. Fallback graceful → 0 si caché caída.
 */
export async function incrementCounterWithTtl(
  key: string,
  ttlSeconds: number,
  by = 1,
): Promise<number> {
  const sink = getSink()
  if (!sink) return 0
  try {
    const result = await raceTimeout(sink.incrby(key, by), REDIS_TIMEOUT_MS)
    if (result === TIMEOUT_SYMBOL) return 0
    // EXPIRE fire-and-forget: no penaliza la latencia del caller.
    sink.expire(key, ttlSeconds).catch(() => {})
    return typeof result === 'number' ? result : Number(result) || 0
  } catch (err) {
    console.warn(`[incrementCounterWithTtl] INCRBY ${key} failed:`, err)
    return 0
  }
}

/**
 * GET numérico best-effort de un contador (sin incrementar). 0 si no existe,
 * caché caída o timeout.
 */
export async function getCounter(key: string): Promise<number> {
  const sink = getSink()
  if (!sink) return 0
  try {
    const result = await raceTimeout(sink.get<number | string>(key), REDIS_TIMEOUT_MS)
    if (result === TIMEOUT_SYMBOL || result === null || result === undefined) return 0
    return typeof result === 'number' ? result : Number(result) || 0
  } catch {
    return 0
  }
}
