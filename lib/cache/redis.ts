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

/**
 * Cache-aside pattern. Si hay cache hit, devuelve. Si miss o Redis falla,
 * llama fetcher y guarda el resultado (best-effort, sin bloquear).
 *
 * @param key Clave única (incluir tipo + userId/identificador)
 * @param ttlSeconds TTL en segundos
 * @param fetcher Función que produce el valor desde la fuente real (BD)
 * @returns El valor cacheado o recién obtenido
 */
export async function getOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const redis = getRedis()

  // Sin Redis: ir directo a fetcher (preserva disponibilidad)
  if (!redis) {
    return fetcher()
  }

  // 1. Intentar GET con timeout estricto
  try {
    const cached = await raceTimeout(redis.get<T>(key), REDIS_TIMEOUT_MS)
    if (cached !== TIMEOUT_SYMBOL && cached !== null && cached !== undefined) {
      return cached
    }
    // Si timeout o miss, seguir a fetcher
  } catch {
    // Error de Redis (network, parse) → fetcher
  }

  // 2. Cache miss o fail → fetcher
  const value = await fetcher()

  // 3. Guardar en cache (fire-and-forget; si falla, no afecta a la respuesta)
  // No await: el SET puede tardar 30ms y la respuesta del usuario no debería
  // esperarlo. Si falla, próxima request será otro miss (aceptable).
  redis.set(key, value, { ex: ttlSeconds }).catch(() => {
    // Silently ignore - el fetcher ya devolvió el valor correcto al usuario
  })

  return value
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
