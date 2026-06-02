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
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'
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
  // Sprint G — JOIN con la convocatoria vigente (is_current) para que el frontend
  // pueda mostrar plazas/fecha sin segunda query. LEFT JOIN LATERAL (LIMIT 1)
  // porque hay oposiciones catalogadas sin convocatoria todavía y replica el
  // .find(is_current) del código supabase anterior (≤1 fila por oposición).
  // coverage_level/convocatorias no están en el schema Drizzle -> raw SQL.
  // Fechas date casteadas a ::text -> 'YYYY-MM-DD' (igual que supabase REST).
  const rows = (await getReadDb().execute(sql`
    SELECT o.id, o.slug, o.nombre, o.short_name, o.categoria, o.administracion,
           o.coverage_level, o.is_active, o.demand_score,
           c."año" AS conv_anio, c.estado_proceso AS conv_estado,
           c.plazas_libres AS conv_plazas, c.exam_date::text AS conv_exam_date,
           c.inscription_start::text AS conv_ins_start,
           c.inscription_deadline::text AS conv_ins_deadline
    FROM oposiciones o
    LEFT JOIN LATERAL (
      SELECT "año", estado_proceso, plazas_libres, exam_date, inscription_start, inscription_deadline
      FROM convocatorias
      WHERE oposicion_id = o.id AND is_current = true
      LIMIT 1
    ) c ON true
    ORDER BY o.demand_score DESC NULLS LAST, o.nombre ASC
  `)) as Array<Record<string, unknown>>

  return rows.map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    nombre: row.nombre as string,
    short_name: (row.short_name as string | null) ?? null,
    categoria: (row.categoria as string | null) ?? null,
    administracion: row.administracion as string,
    coverage_level: row.coverage_level as OposicionCatalogEntry['coverage_level'],
    is_active: row.is_active as boolean,
    demand_score: (row.demand_score as number | null) ?? null,
    convocatoria_año: (row.conv_anio as number | null) ?? null,
    convocatoria_estado_proceso: (row.conv_estado as string | null) ?? null,
    convocatoria_plazas_libres: (row.conv_plazas as number | null) ?? null,
    convocatoria_exam_date: (row.conv_exam_date as string | null) ?? null,
    convocatoria_inscription_start: (row.conv_ins_start as string | null) ?? null,
    convocatoria_inscription_deadline: (row.conv_ins_deadline as string | null) ?? null,
  } satisfies OposicionCatalogEntry))
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
