// lib/api/laws/warmCache.ts - Puente entre BD y cache síncrono (lawMappingUtils)
//
// Usa Supabase client (funciona en cliente y servidor) en vez de Drizzle/postgres
// para que los fetchers puedan importar este módulo sin romper el bundle del browser.

import { getSupabaseClient } from '@/lib/supabase'
import { setDbCache, isDbCacheLoaded, invalidateDbCache } from '@/lib/lawMappingUtils'

/**
 * Calienta el cache síncrono de lawMappingUtils con datos de la BD via Supabase.
 * Si el cache ya está cargado, es un no-op (no hace query).
 * Si la BD falla, devuelve false y el diccionario estático sigue funcionando.
 */
export async function warmSlugCache(): Promise<boolean> {
  if (isDbCacheLoaded()) {
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

    setDbCache(slugToShortName, shortNameToSlug)
    return true
  } catch (error) {
    console.warn('⚠️ [warmCache] No se pudo cargar cache de BD, usando diccionario estático:', error)
    return false
  }
}

/**
 * Invalida el cache síncrono de lawMappingUtils.
 * El próximo warmSlugCache() recargará desde BD.
 */
export function invalidateAllSlugCaches(): void {
  invalidateDbCache()
  console.log('🗑️ [warmCache] Cache síncrono invalidado')
}
