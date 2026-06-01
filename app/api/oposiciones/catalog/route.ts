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
  // Sprint G — JOIN con la convocatoria vigente para que el frontend
  // pueda mostrar plazas/fecha sin segunda query. LEFT JOIN porque hay
  // oposiciones catalogadas sin convocatoria todavía (esperando sensor LLM).
  const { data, error } = await supabase
    .from('oposiciones')
    .select('id, slug, nombre, short_name, categoria, administracion, coverage_level, is_active, demand_score, convocatorias(año, estado_proceso, plazas_libres, exam_date, inscription_start, inscription_deadline, is_current)')
    .order('demand_score', { ascending: false, nullsFirst: false })
    .order('nombre', { ascending: true })

  if (error) {
    console.error('❌ [/api/oposiciones/catalog] BD query error:', error)
    throw error
  }

  // Aplanar: extraer la convocatoria vigente (is_current=true) si existe
  type RawRow = {
    id: string
    slug: string
    nombre: string
    short_name: string | null
    categoria: string | null
    administracion: string
    coverage_level: OposicionCatalogEntry['coverage_level']
    is_active: boolean
    demand_score: number | null
    convocatorias: Array<{
      año: number
      estado_proceso: string | null
      plazas_libres: number | null
      exam_date: string | null
      inscription_start: string | null
      inscription_deadline: string | null
      is_current: boolean
    }>
  }

  return ((data ?? []) as unknown as RawRow[]).map((row) => {
    const vigente = row.convocatorias?.find(c => c.is_current === true)
    return {
      id: row.id,
      slug: row.slug,
      nombre: row.nombre,
      short_name: row.short_name,
      categoria: row.categoria,
      administracion: row.administracion,
      coverage_level: row.coverage_level,
      is_active: row.is_active,
      demand_score: row.demand_score,
      convocatoria_año: vigente?.año ?? null,
      convocatoria_estado_proceso: vigente?.estado_proceso ?? null,
      convocatoria_plazas_libres: vigente?.plazas_libres ?? null,
      convocatoria_exam_date: vigente?.exam_date ?? null,
      convocatoria_inscription_start: vigente?.inscription_start ?? null,
      convocatoria_inscription_deadline: vigente?.inscription_deadline ?? null,
    } satisfies OposicionCatalogEntry
  })
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
