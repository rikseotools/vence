// lib/api/laws/warmCache.ts - Puente entre BD y cache síncrono
//
// Usa Supabase client (funciona en cliente y servidor) en vez de Drizzle/postgres
// para que los fetchers puedan importar este módulo sin romper el bundle del browser.

import { getSupabaseClient } from '@/lib/supabase'
import {
  setSyncCache,
  isSyncCacheLoaded,
  invalidateSyncCache,
} from '@/lib/lawSlugSync'

/**
 * Calienta el cache síncrono con datos de la BD via Supabase.
 * Si el cache ya está cargado, es un no-op (no hace query).
 * Si la BD falla, devuelve false y el pattern fallback sigue funcionando.
 */
export async function warmSlugCache(): Promise<boolean> {
  if (isSyncCacheLoaded()) {
    return true
  }

  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('laws')
      .select('short_name, slug')
      .eq('is_active', true)
      .not('slug', 'is', null)

    if (error || !data) {
      console.warn('⚠️ [warmCache] Error cargando slugs:', error?.message)
      return false
    }

    const slugToShortName = new Map<string, string>()
    const shortNameToSlug = new Map<string, string>()

    for (const law of data) {
      if (law.slug && law.short_name) {
        slugToShortName.set(law.slug, law.short_name)
        shortNameToSlug.set(law.short_name, law.slug)
      }
    }

    setSyncCache(slugToShortName, shortNameToSlug)
    return true
  } catch (error) {
    console.warn('⚠️ [warmCache] No se pudo cargar cache de BD:', error)
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
