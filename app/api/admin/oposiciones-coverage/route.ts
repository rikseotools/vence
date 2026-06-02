/**
 * GET /api/admin/oposiciones-coverage
 *
 * Datos para el dashboard /admin/oposiciones-coverage (Sprint E del roadmap
 * docs/roadmap/oposiciones-coverage-level-y-promocion-automatica.md).
 *
 * Devuelve:
 *  - Counts por coverage_level (con desglose is_active true/false).
 *  - Counts por administración × coverage_level.
 *  - Últimos 30 saltos registrados en coverage_history.
 *  - Catalogadas sin seguimiento_url (deuda Sprint C.6).
 *
 * SLAs medios + predicción del próximo cron quedan para iteración siguiente
 * (requieren SQL con self-join sobre coverage_history; mejor como RPC PG).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getReadDb } from '@/db/client'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

interface CoverageStats {
  byLevel: Array<{ level: string; total: number; active: number; inactive: number }>
  byAdminLevel: Array<{ administracion: string; level: string; total: number }>
  recentJumps: Array<{
    slug: string
    nombre: string
    from_level: string
    to_level: string
    reason: string
    changed_by: string
    changed_at: string
  }>
  sinSeguimientoUrl: Array<{ slug: string; nombre: string; administracion: string; coverage_level: string }>
  totals: { total: number; con_url: number; sin_url: number }
}

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response
  const db = getReadDb()

  // 1) Counts por coverage_level
  const rawCounts = (await db.execute(sql`
    SELECT coverage_level, is_active FROM oposiciones
  `)) as any[]

  const byLevelMap: Record<string, { total: number; active: number; inactive: number }> = {}
  for (const r of rawCounts ?? []) {
    const lvl = r.coverage_level
    if (!byLevelMap[lvl]) byLevelMap[lvl] = { total: 0, active: 0, inactive: 0 }
    byLevelMap[lvl].total++
    if (r.is_active) byLevelMap[lvl].active++
    else byLevelMap[lvl].inactive++
  }
  const ORDER = ['catalogada', 'monitorizada', 'con_temario', 'con_tests', 'con_landing', 'full']
  const byLevel = ORDER.map(lvl => ({ level: lvl, ...(byLevelMap[lvl] ?? { total: 0, active: 0, inactive: 0 }) }))

  // 2) Counts por administración × coverage_level
  const rawAdmin = (await db.execute(sql`
    SELECT administracion, coverage_level FROM oposiciones
  `)) as any[]

  const byAdminMap: Record<string, Record<string, number>> = {}
  for (const r of rawAdmin ?? []) {
    const adm = r.administracion ?? '(unknown)'
    if (!byAdminMap[adm]) byAdminMap[adm] = {}
    byAdminMap[adm][r.coverage_level] = (byAdminMap[adm][r.coverage_level] ?? 0) + 1
  }
  const byAdminLevel: Array<{ administracion: string; level: string; total: number }> = []
  for (const [adm, levels] of Object.entries(byAdminMap)) {
    for (const [lvl, n] of Object.entries(levels)) {
      byAdminLevel.push({ administracion: adm, level: lvl, total: n })
    }
  }
  byAdminLevel.sort((a, b) => a.administracion.localeCompare(b.administracion) || a.level.localeCompare(b.level))

  // 3) Últimos 30 saltos
  const rawJumps = (await db.execute(sql`
    SELECT ch.from_level, ch.to_level, ch.reason, ch.changed_by, ch.changed_at,
           o.slug AS opo_slug, o.nombre AS opo_nombre
    FROM coverage_history ch
    LEFT JOIN oposiciones o ON ch.oposicion_id = o.id
    ORDER BY ch.changed_at DESC
    LIMIT 30
  `)) as any[]

  const recentJumps = rawJumps.map((r: Record<string, unknown>) => ({
    slug: (r.opo_slug as string) ?? '(unknown)',
    nombre: (r.opo_nombre as string) ?? '(unknown)',
    from_level: r.from_level as string,
    to_level: r.to_level as string,
    reason: r.reason as string,
    changed_by: r.changed_by as string,
    changed_at: r.changed_at as string,
  }))

  // 4) Catalogadas sin seguimiento_url
  const rawSin = (await db.execute(sql`
    SELECT slug, nombre, administracion, coverage_level
    FROM oposiciones
    WHERE coverage_level = 'catalogada' AND seguimiento_url IS NULL
    ORDER BY slug
  `)) as any[]

  const sinSeguimientoUrl = rawSin.map((r: Record<string, unknown>) => ({
    slug: r.slug as string,
    nombre: r.nombre as string,
    administracion: (r.administracion as string) ?? '(unknown)',
    coverage_level: r.coverage_level as string,
  }))

  // 5) Totals
  const totalRow = (await db.execute(sql`SELECT count(*)::int AS c FROM oposiciones`)) as any[]
  const conRow = (await db.execute(sql`SELECT count(*)::int AS c FROM oposiciones WHERE seguimiento_url IS NOT NULL`)) as any[]
  const sinRow = (await db.execute(sql`SELECT count(*)::int AS c FROM oposiciones WHERE seguimiento_url IS NULL`)) as any[]

  const response: CoverageStats = {
    byLevel,
    byAdminLevel,
    recentJumps,
    sinSeguimientoUrl,
    totals: {
      total: totalRow[0]?.c ?? 0,
      con_url: conRow[0]?.c ?? 0,
      sin_url: sinRow[0]?.c ?? 0,
    },
  }

  return NextResponse.json(response)
}

export const GET = withErrorLogging('/api/admin/oposiciones-coverage', _GET)
