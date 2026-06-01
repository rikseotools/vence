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
import { requireAdmin, getServiceClient } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

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
  const supabase = getServiceClient()

  // 1) Counts por coverage_level
  const { data: rawCounts } = await supabase
    .from('oposiciones')
    .select('coverage_level, is_active')

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
  const { data: rawAdmin } = await supabase
    .from('oposiciones')
    .select('administracion, coverage_level')

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
  const { data: rawJumps } = await supabase
    .from('coverage_history')
    .select('from_level, to_level, reason, changed_by, changed_at, oposiciones(slug, nombre)')
    .order('changed_at', { ascending: false })
    .limit(30)

  const recentJumps = (rawJumps ?? []).map((r: Record<string, unknown>) => {
    const opo = r.oposiciones as { slug?: string; nombre?: string } | null
    return {
      slug: opo?.slug ?? '(unknown)',
      nombre: opo?.nombre ?? '(unknown)',
      from_level: r.from_level as string,
      to_level: r.to_level as string,
      reason: r.reason as string,
      changed_by: r.changed_by as string,
      changed_at: r.changed_at as string,
    }
  })

  // 4) Catalogadas sin seguimiento_url
  const { data: rawSin } = await supabase
    .from('oposiciones')
    .select('slug, nombre, administracion, coverage_level')
    .eq('coverage_level', 'catalogada')
    .is('seguimiento_url', null)
    .order('slug')

  const sinSeguimientoUrl = (rawSin ?? []).map(r => ({
    slug: r.slug,
    nombre: r.nombre,
    administracion: r.administracion ?? '(unknown)',
    coverage_level: r.coverage_level,
  }))

  // 5) Totals
  const { count: total } = await supabase.from('oposiciones').select('*', { count: 'exact', head: true })
  const { count: con_url } = await supabase.from('oposiciones').select('*', { count: 'exact', head: true }).not('seguimiento_url', 'is', null)
  const { count: sin_url } = await supabase.from('oposiciones').select('*', { count: 'exact', head: true }).is('seguimiento_url', null)

  const response: CoverageStats = {
    byLevel,
    byAdminLevel,
    recentJumps,
    sinSeguimientoUrl,
    totals: { total: total ?? 0, con_url: con_url ?? 0, sin_url: sin_url ?? 0 },
  }

  return NextResponse.json(response)
}

export const GET = withErrorLogging('/api/admin/oposiciones-coverage', _GET)
