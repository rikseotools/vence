/**
 * GET /api/oposiciones/catalog
 *
 * Devuelve el catálogo completo de oposiciones (todas las que están en BD
 * con coverage_level >= 'catalogada'). Consumido por:
 *   - components/OnboardingModal.tsx (búsqueda de oposición al onboarding)
 *   - app/perfil/page.tsx (selector de cambio de oposición)
 *   - components/OposicionChangeModal (futuro)
 *   - lib/utils/searchOposicion.ts (guard al hacer tests)
 *
 * Cache multi-capa según docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md §Sprint B:
 *   1. Cliente: SWR + localStorage (en el componente consumidor).
 *   2. Vercel Edge CDN: revalidate=600s (10 min) + tag 'oposiciones-catalog'.
 *   3. Redis Upstash: key 'oposiciones:catalog:v1' TTL 600s con singleflight.
 *   4. PostgreSQL: índice compuesto (coverage_level, categoria, administracion).
 *
 * Invalidación: cualquier UPDATE/INSERT en `oposiciones` debe llamar a
 * `invalidateCatalog(slug)` de `lib/cache/oposiciones-catalog.ts`. El cron
 * `auto-promote-coverage` (Sprint D) también la invalida tras cada salto.
 */

import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import {
  getCachedCatalog,
  type OposicionCatalogEntry,
} from '@/lib/cache/oposiciones-catalog'

// Next.js ISR — el HTML/JSON renderizado se cachea 10 min en Vercel Edge.
// stale-while-revalidate hasta 24h: si el cache se cae, los usuarios reciben
// el valor antiguo mientras Vercel re-genera en background.
export const revalidate = 600
export const dynamic = 'force-static'

async function fetchFromDb(): Promise<OposicionCatalogEntry[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from('oposiciones')
    .select('id, slug, nombre, short_name, categoria, administracion, coverage_level, is_active, demand_score')
    .order('demand_score', { ascending: false, nullsFirst: false })
    .order('nombre', { ascending: true })

  if (error) {
    console.error('❌ [/api/oposiciones/catalog] BD query error:', error)
    throw error
  }
  return (data ?? []) as OposicionCatalogEntry[]
}

async function _GET() {
  try {
    const catalog = await getCachedCatalog(fetchFromDb)
    return NextResponse.json(
      { ok: true, total: catalog.length, oposiciones: catalog },
      {
        headers: {
          // Vercel Edge: 10 min fresh + 24h stale.
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400',
        },
      },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, error: msg, oposiciones: [] },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/oposiciones/catalog', _GET)
