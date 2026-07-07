// lib/cache/versionStore.ts
//
// Contador de versión por tag para invalidación CROSS-INSTANCIA del cache del
// frontend. AGNÓSTICO de proveedor: usa el "sink" de lib/cache/redis.ts, que
// abstrae el KV (Upstash hoy → ElastiCache / Koigrid / lo que sea mañana, por
// env). Cambiar de proveedor = cambiar el sink, sin tocar este código ni los
// call-sites — igual que la BD es agnóstica vía Drizzle + DATABASE_URL.
//
// PROBLEMA QUE RESUELVE:
// En AWS el frontend corre como N contenedores Next.js standalone, cada uno con
// su propio `unstable_cache` EN MEMORIA. `revalidateTag()` solo invalida la
// instancia que atiende la petición del endpoint → las demás siguen sirviendo lo
// viejo. (El ARCHITECTURE_ROADMAP lo preveía: en AWS la invalidación por tag
// necesita "hook propio ... versioned cache pattern".)
//
// SOLUCIÓN (patrón "versioned cache keys", el MISMO que el backend NestJS):
// todas las instancias LEEN la misma versión de un tag desde el KV compartido.
// Invalidar = INCR (atómico, O(1)). El wrapper `versionedCache` incorpora la
// versión a la clave del `unstable_cache`, así que al subir la versión TODAS las
// instancias fallan el caché y recomputan.
//
// COHERENCIA CROSS-RUNTIME: usamos la MISMA convención de key `cache_version:${tag}`
// que el backend (backend/src/cache/cache-versioning.service.ts) sobre la MISMA
// instancia Upstash → invalidar un tag afecta a front Y back a la vez.
//
// DEGRADACIÓN GRACEFUL: si el KV está caído, getCounter/incrementCounter
// devuelven 0 (nunca lanzan). El cache sigue sirviendo con versión estable; solo
// se pierde la capacidad de invalidar hasta que el KV vuelva.

import { getCounter, incrementCounter } from '@/lib/cache/redis'
import { createGlobalCache } from '@/lib/cache/globalCache'

const VERSION_KEY_PREFIX = 'cache_version:'

// Micro-caché local (por instancia) de la versión, para no hacer un GET al KV en
// CADA render. TTL corto: tras un INCR, las demás instancias ven la versión nueva
// en ≤ este tiempo. Mismo criterio que el "cache local 1s" del backend.
const VERSION_LOCAL_TTL_MS = 3_000

// Un slot de globalThis por tag (compartido cross-bundle vía createGlobalCache).
function localVersionCache(tag: string) {
  return createGlobalCache<number>(`cache-version-${tag}`, VERSION_LOCAL_TTL_MS)
}

/**
 * Versión actual del tag (0 si nunca se ha invalidado o si el KV falla —
 * degradación graceful). Cacheada localmente VERSION_LOCAL_TTL_MS.
 */
export async function getCacheVersion(tag: string): Promise<number> {
  return localVersionCache(tag).getOrLoad(() => getCounter(VERSION_KEY_PREFIX + tag))
}

/**
 * Incrementa (INCR atómico) la versión del tag en el KV compartido e invalida la
 * micro-caché local de esta instancia (para que vea la versión nueva ya). Las
 * demás instancias la ven en ≤VERSION_LOCAL_TTL_MS. Devuelve la nueva versión
 * (0 si el KV está caído — best-effort, no lanza).
 */
export async function bumpCacheVersion(tag: string): Promise<number> {
  const version = await incrementCounter(VERSION_KEY_PREFIX + tag)
  localVersionCache(tag).invalidate()
  return version
}
