// lib/cache/versionStore.ts
//
// Contador de versión por tag, agnóstico (Postgres/Drizzle), para invalidación
// CROSS-INSTANCIA del cache del frontend.
//
// PROBLEMA QUE RESUELVE:
// En AWS el frontend corre como N contenedores Next.js standalone, cada uno con
// su propio `unstable_cache` EN MEMORIA. `revalidateTag()` solo invalida la
// instancia que atiende la petición del endpoint de revalidación → las demás
// siguen sirviendo lo viejo. (El ARCHITECTURE_ROADMAP lo preveía: en AWS la
// invalidación por tag necesita "hook propio ... versioned cache pattern".)
//
// SOLUCIÓN:
// Todas las instancias LEEN la misma versión de un tag desde Postgres. Invalidar
// = incrementar la versión (atómico). El wrapper `versionedCache` incorpora la
// versión a la clave del `unstable_cache`, así que al subir la versión TODAS las
// instancias fallan el caché y recomputan. Cero dependencia de Redis/Supabase.
//
// AGNÓSTICO: solo Drizzle + DATABASE_URL (portable a Neon/RDS/Aurora). Es el
// mismo patrón "versioned cache keys" del backend NestJS (cache_version:${tag}
// en Upstash), pero con el store en nuestra Postgres — sin depender de que Redis
// esté arriba en el camino crítico de lectura del cache.

import { getDb, getAdminDb } from '@/db/client'
import { cacheVersions } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { createGlobalCache } from '@/lib/cache/globalCache'

// Micro-caché local de la versión (por instancia) para no leer Postgres en cada
// request. TTL corto: tras un bump, las demás instancias ven la versión nueva en
// ≤ este tiempo. Coherente con el "cache local 1s" del patrón del backend.
const VERSION_LOCAL_TTL_MS = 3_000

// Un slot de globalThis por tag (compartido cross-bundle vía createGlobalCache).
function localVersionCache(tag: string) {
  return createGlobalCache<number>(`cache-version-${tag}`, VERSION_LOCAL_TTL_MS)
}

/**
 * Devuelve la versión actual del tag (0 si nunca se ha invalidado o si la BD
 * falla — degradación graceful: el cache sigue funcionando con versión estable).
 * Cacheada localmente VERSION_LOCAL_TTL_MS para amortizar el read.
 */
export async function getCacheVersion(tag: string): Promise<number> {
  return localVersionCache(tag).getOrLoad(async () => {
    try {
      const rows = await getDb()
        .select({ version: cacheVersions.version })
        .from(cacheVersions)
        .where(eq(cacheVersions.tag, tag))
        .limit(1)
      return rows[0]?.version ?? 0
    } catch (err) {
      // Nunca romper el render por el store de versiones. Sin versión → 0
      // (equivale a "sin invalidaciones"): el cache sirve, solo pierde la
      // capacidad de invalidar hasta que la BD vuelva.
      console.warn(`[getCacheVersion] read failed for tag "${tag}", using 0:`, err instanceof Error ? err.message : err)
      return 0
    }
  })
}

/**
 * Incrementa (o crea) la versión del tag de forma atómica en Postgres e invalida
 * la micro-caché local de esta instancia (para que vea la versión nueva ya).
 * Devuelve la nueva versión. Fire-and-forget seguro: propaga el error para que
 * el caller decida, pero los callers de invalidación suelen ignorarlo (best-effort).
 */
export async function bumpCacheVersion(tag: string): Promise<number> {
  const res = await getAdminDb().execute(
    sql`SELECT public.bump_cache_version(${tag}) AS version`
  )
  const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as Array<{ version: number | string }>
  const version = Number(rows[0]?.version ?? 0)
  // Esta instancia ve la versión nueva inmediatamente; las demás en ≤TTL.
  localVersionCache(tag).invalidate()
  return version
}
