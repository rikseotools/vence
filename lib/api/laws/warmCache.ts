// lib/api/laws/warmCache.ts - Puente entre la BD y el cache síncrono de slugs.
//
// AGNÓSTICO (04/07): antes usaba el cliente Supabase directo; ahora consume el
// endpoint público /api/v2/law-slugs (que sí usa Drizzle/RDS server-side) para
// funcionar en cliente Y servidor SIN arrastrar `postgres` al bundle del browser.

import {
  setSyncCache,
  isSyncCacheLoaded,
  invalidateSyncCache,
} from '@/lib/lawSlugSync'

/**
 * Calienta el cache síncrono con el mapping de slugs desde /api/v2/law-slugs.
 * Si el cache ya está cargado, es un no-op (no hace fetch).
 * Si el fetch falla, devuelve false y el pattern fallback sigue funcionando.
 */
export async function warmSlugCache(): Promise<boolean> {
  if (isSyncCacheLoaded()) {
    return true
  }

  try {
    // Cliente: URL relativa. Servidor (SSR): absoluta vía NEXT_PUBLIC_SITE_URL.
    const base = typeof window === 'undefined' ? (process.env.NEXT_PUBLIC_SITE_URL || '') : ''
    const res = await fetch(`${base}/api/v2/law-slugs`, { headers: { accept: 'application/json' } })
    if (!res.ok) {
      console.warn('⚠️ [warmCache] Error cargando slugs: HTTP', res.status)
      return false
    }
    const json = await res.json()
    const mappings: Array<{ slug?: string; shortName?: string }> = json?.mappings || []

    const slugToShortName = new Map<string, string>()
    const shortNameToSlug = new Map<string, string>()

    for (const law of mappings) {
      if (law.slug && law.shortName) {
        slugToShortName.set(law.slug, law.shortName)
        shortNameToSlug.set(law.shortName, law.slug)
      }
    }

    setSyncCache(slugToShortName, shortNameToSlug)
    return true
  } catch (error) {
    console.warn('⚠️ [warmCache] No se pudo cargar cache de slugs:', error)
    return false
  }
}

/**
 * Invalida el cache síncrono.
 * El próximo warmSlugCache() recargará desde BD.
 */
export function invalidateAllSlugCaches(): void {
  invalidateSyncCache()
  console.log('🗑️ [warmCache] Cache síncrono invalidado')
}
