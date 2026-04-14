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

  const summary = { new: { calls: 0, zeroCount: 0, sumArticles: 0, sumDuration: 0, durationCount: 0 },
                    old: { calls: 0, zeroCount: 0, sumArticles: 0, sumDuration: 0, durationCount: 0 } }
  const distinctUsers = { new: new Set<string>(), old: new Set<string>() }

  for (const r of rows ?? []) {
    const bucket = r.path === 'new' ? summary.new : summary.old
    bucket.calls += 1
    bucket.sumArticles += r.articles_count ?? 0
    if ((r.articles_count ?? 0) === 0) bucket.zeroCount += 1
    if (typeof r.duration_ms === 'number') {
      bucket.sumDuration += r.duration_ms
      bucket.durationCount += 1
    }
    if (r.user_id) distinctUsers[r.path === 'new' ? 'new' : 'old'].add(r.user_id)
  }

  const buildStats = (b: typeof summary.new, users: Set<string>) => ({
    calls: b.calls,
    distinctUsers: users.size,
    avgArticles: b.calls > 0 ? Number((b.sumArticles / b.calls).toFixed(2)) : 0,
    zeroCount: b.zeroCount,
    zeroPct: b.calls > 0 ? Number(((b.zeroCount / b.calls) * 100).toFixed(1)) : 0,
    avgDurationMs: b.durationCount > 0 ? Math.round(b.sumDuration / b.durationCount) : null,
  })

  return NextResponse.json({
    success: true,
    hours,
    summary: {
      new: buildStats(summary.new, distinctUsers.new),
      old: buildStats(summary.old, distinctUsers.old),
    },
    rows: (rows ?? []).slice(0, 100),
  })
}

export const GET = withErrorLogging('/api/v2/admin/problematic-articles-rollout', _GET)
