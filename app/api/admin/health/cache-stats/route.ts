// app/api/admin/health/cache-stats/route.ts
// Snapshot de hits/misses del cache (Phase 6 obs).
//
// Auth: Bearer CRON_SECRET. Mismo patrón que /api/admin/health.
//
// Uso:
//   curl -H "Authorization: Bearer $CRON_SECRET" \
//     'https://www.vence.es/api/admin/health/cache-stats'
//
//   # Resetear contadores (p.ej. tras deploy):
//   curl -X DELETE -H "Authorization: Bearer $CRON_SECRET" \
//     'https://www.vence.es/api/admin/health/cache-stats'
//
// Response:
// {
//   success: true,
//   stats: {
//     "user_stats": { hit: 1234, miss: 56, hitRate: 0.957 },
//     "exam_pending": { hit: 89, miss: 11, hitRate: 0.89 },
//     ...
//   },
//   total: { hit: 1323, miss: 67, hitRate: 0.952 }
// }

import { NextResponse, type NextRequest } from 'next/server'
import { getCacheMetrics, resetCacheMetrics } from '@/lib/cache/redis'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const runtime = 'nodejs'
export const maxDuration = 10
export const dynamic = 'force-dynamic'

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`
  return !!process.env.CRON_SECRET && authHeader === expected
}

interface PrefixStats {
  hit: number
  miss: number
  hitRate: number  // 0..1
}

function aggregate(metrics: Record<string, number>): {
  byPrefix: Record<string, PrefixStats>
  total: PrefixStats
} {
  const byPrefix: Record<string, PrefixStats> = {}
  let totalHit = 0
  let totalMiss = 0

  for (const [field, value] of Object.entries(metrics)) {
    // field es `${prefix}:hit` o `${prefix}:miss`
    const idx = field.lastIndexOf(':')
    if (idx === -1) continue
    const prefix = field.slice(0, idx)
    const kind = field.slice(idx + 1)
    if (kind !== 'hit' && kind !== 'miss') continue

    if (!byPrefix[prefix]) {
      byPrefix[prefix] = { hit: 0, miss: 0, hitRate: 0 }
    }
    byPrefix[prefix][kind] = value
    if (kind === 'hit') totalHit += value
    else totalMiss += value
  }

  // Calcular hitRate por prefijo y total
  for (const stats of Object.values(byPrefix)) {
    const sum = stats.hit + stats.miss
    stats.hitRate = sum > 0 ? Math.round((stats.hit / sum) * 1000) / 1000 : 0
  }

  const totalSum = totalHit + totalMiss
  const total: PrefixStats = {
    hit: totalHit,
    miss: totalMiss,
    hitRate: totalSum > 0 ? Math.round((totalHit / totalSum) * 1000) / 1000 : 0,
  }

  return { byPrefix, total }
}

async function _GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const metrics = await getCacheMetrics()
  const { byPrefix, total } = aggregate(metrics)

  return NextResponse.json({
    success: true,
    stats: byPrefix,
    total,
    metricsEnabled: process.env.CACHE_METRICS_ENABLED !== 'false',
    timestamp: new Date().toISOString(),
  })
}

async function _DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  await resetCacheMetrics()
  return NextResponse.json({
    success: true,
    message: 'Cache metrics reseteados',
    timestamp: new Date().toISOString(),
  })
}

export const GET = withErrorLogging('/api/admin/health/cache-stats', _GET)
export const DELETE = withErrorLogging('/api/admin/health/cache-stats', _DELETE)
