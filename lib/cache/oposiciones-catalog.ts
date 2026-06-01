/**
 * Helper de cache para el catálogo de oposiciones.
 *
 * Encapsula la key + TTL + invalidación para que TODOS los puntos que
 * accedan al catálogo (endpoint público, OnboardingModal, perfil, guards)
 * pasen por la misma capa de cache.
 *
 * Patrón cache-aside con singleflight (vía getOrSet).
 *
 * Roadmap: docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md §Sprint B.
 */

import { getOrSet, invalidateMany } from './redis'

export const OPOSICIONES_CATALOG_KEY = 'oposiciones:catalog:v1'
export const OPOSICIONES_CATALOG_TTL = 600 // 10 min, alineado con Vercel ISR

export interface OposicionCatalogEntry {
  id: string
  slug: string
  nombre: string
  short_name: string | null
  categoria: string | null
  administracion: string
  coverage_level: 'catalogada' | 'monitorizada' | 'con_temario' | 'con_tests' | 'con_landing' | 'full'
  is_active: boolean
  demand_score: number | null
  // icon/emoji se calcula desde administracion en el cliente para no duplicar data
}

/**
 * Devuelve el catálogo completo desde cache (Redis → BD).
 *
 * Server-side only: usa fetcher async que toca Supabase con service_role
 * (lee TODAS las oposiciones, incluidas catalogadas con is_active=false).
 * El endpoint /api/oposiciones/catalog hace de gateway público.
 */
export async function getCachedCatalog(
  fetcher: () => Promise<OposicionCatalogEntry[]>,
): Promise<OposicionCatalogEntry[]> {
  return getOrSet(OPOSICIONES_CATALOG_KEY, OPOSICIONES_CATALOG_TTL, fetcher)
}

/**
 * Invalida el cache del catálogo + del slug específico si se pasa.
 *
 * Llamar tras cualquier UPDATE/INSERT/DELETE en `oposiciones` que afecte
 * a campos del listado público: nombre, coverage_level, is_active, demand_score.
 */
export async function invalidateCatalog(slug?: string): Promise<void> {
  const keys = [OPOSICIONES_CATALOG_KEY]
  if (slug) keys.push(`oposiciones:slug:${slug}:v1`)
  await invalidateMany(keys)
}
