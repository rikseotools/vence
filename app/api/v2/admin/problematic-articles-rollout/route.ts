// app/api/v2/admin/problematic-articles-rollout/route.ts
// Datos para el panel de monitoreo del despliegue gradual.
// Ver docs/maintenance/despliegue-articulos-problematicos.md

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const supabase = auth.supabase
  const { searchParams } = new URL(request.url)
  const hours = Math.max(1, Math.min(720, parseInt(searchParams.get('hours') || '24', 10) || 24))
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString()

  // Resumen agregado por path.
  const { data: rows, error } = await supabase
    .from('problematic_articles_rollout_logs')
    .select('path, articles_count, duration_ms, user_id, position_type, law_names, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Agregar por usuario para métricas más fiables (el hook hace polling y
  // un mismo usuario puede generar decenas de llamadas en una sesión).
  // Un usuario se considera "con 0 artículos" solo si TODAS sus llamadas
  // devolvieron 0 en la ventana (nunca tuvo resultados).
  type UserAgg = { calls: number; sumArticles: number; maxArticles: number }
  const perUser = { new: new Map<string, UserAgg>(), old: new Map<string, UserAgg>() }
  const summary = { new: { calls: 0, sumArticles: 0, sumDuration: 0, durationCount: 0 },
                    old: { calls: 0, sumArticles: 0, sumDuration: 0, durationCount: 0 } }

  for (const r of rows ?? []) {
    const bucketKey: 'new' | 'old' = r.path === 'new' ? 'new' : 'old'
    const bucket = summary[bucketKey]
    bucket.calls += 1
    const ac = r.articles_count ?? 0
    bucket.sumArticles += ac
    if (typeof r.duration_ms === 'number') {
      bucket.sumDuration += r.duration_ms
      bucket.durationCount += 1
    }
    if (r.user_id) {
      const map = perUser[bucketKey]
      const u = map.get(r.user_id) ?? { calls: 0, sumArticles: 0, maxArticles: 0 }
      u.calls += 1
      u.sumArticles += ac
      if (ac > u.maxArticles) u.maxArticles = ac
      map.set(r.user_id, u)
    }
  }

  const buildStats = (b: typeof summary.new, users: Map<string, UserAgg>) => {
    const total = users.size
    const zeroUsers = Array.from(users.values()).filter((u) => u.maxArticles === 0).length
    return {
      calls: b.calls,
      distinctUsers: total,
      avgArticles: b.calls > 0 ? Number((b.sumArticles / b.calls).toFixed(2)) : 0,
      // Usuarios que NUNCA recibieron artículos en la ventana (métrica fiable)
      zeroUsers,
      zeroUsersPct: total > 0 ? Number(((zeroUsers / total) * 100).toFixed(1)) : 0,
      avgDurationMs: b.durationCount > 0 ? Math.round(b.sumDuration / b.durationCount) : null,
    }
  }

  return NextResponse.json({
    success: true,
    hours,
    summary: {
      new: buildStats(summary.new, perUser.new),
      old: buildStats(summary.old, perUser.old),
    },
    rows: (rows ?? []).slice(0, 100),
  })
}

export const GET = withErrorLogging('/api/v2/admin/problematic-articles-rollout', _GET)
