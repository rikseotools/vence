// lib/cache/versionedCache.ts
//
// Wrapper sobre `unstable_cache` de Next.js que lo hace invalidable
// CROSS-INSTANCIA vía el contador de versión en Postgres (lib/cache/versionStore).
//
// POR QUÉ:
// `revalidateTag()` en Next.js standalone solo invalida el proceso que lo
// ejecuta. Con N contenedores ECS, invalidar por tag desde un endpoint solo
// afecta a 1 instancia. Metiendo la versión del tag (leída de Postgres, común a
// todas las instancias) dentro de la CLAVE del unstable_cache, un bump de versión
// cambia la clave para TODAS las instancias → todas fallan el caché y recomputan.
//
// USO:
//   export const getThemeQuestionCounts = versionedCache(
//     getThemeQuestionCountsInternal,
//     { tag: 'test-counts', keyParts: ['theme-question-counts-v1'] }
//   )
//
// Invalidar (cualquier instancia, cross-instancia):
//   import { bumpCacheVersion } from '@/lib/cache/versionStore'
//   await bumpCacheVersion('test-counts')
//
// El endpoint /api/admin/revalidate ya hace el bump por tag.

import { unstable_cache } from 'next/cache'
import { getCacheVersion } from '@/lib/cache/versionStore'

interface VersionedCacheOptions {
  /** Tag lógico. La invalidación se hace con bumpCacheVersion(tag). */
  tag: string
  /** Prefijo estable de la clave (incluir versión de forma/esquema: '-v1'). */
  keyParts: string[]
  /**
   * TTL del unstable_cache. Default `false` (permanente): la invalidación la da
   * el bump de versión, no un TTL. Las entradas de versiones viejas dejan de
   * pedirse y las desaloja el LRU / el reinicio del contenedor. Poner un número
   * (segundos) solo si además quieres refresco periódico de seguridad.
   */
  revalidate?: number | false
}

/**
 * Envuelve una función async en un `unstable_cache` versionado por Postgres.
 * Los argumentos de la función siguen formando parte de la clave (comportamiento
 * estándar de unstable_cache), así que cachea por-args igual que antes; lo único
 * que añade es el segmento de versión para invalidación cross-instancia.
 */
export function versionedCache<A extends unknown[], T>(
  fn: (...args: A) => Promise<T>,
  { tag, keyParts, revalidate = false }: VersionedCacheOptions
): (...args: A) => Promise<T> {
  return async (...args: A): Promise<T> => {
    const version = await getCacheVersion(tag)
    const cached = unstable_cache(
      fn,
      [...keyParts, tag, `v${version}`],
      { revalidate, tags: [tag] }
    )
    return cached(...args)
  }
}
