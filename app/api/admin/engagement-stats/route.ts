// app/api/admin/engagement-stats/route.ts - API para estadísticas completas de engagement
import { NextRequest, NextResponse } from 'next/server'
import { getFullEngagementStats } from '@/lib/api/admin-engagement-stats'
import { unstable_cache } from 'next/cache'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

// Cache server-side: 5 minutos. Las estadísticas de engagement no cambian en segundos.
const getCachedEngagementStats = unstable_cache(
  () => getFullEngagementStats(),
  ['admin-engagement-stats'],
  { revalidate: 300, tags: ['engagement'] }
)

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]

function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

async function _GET(request: NextRequest) {
  try {
    // Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/admin/engagement-stats')
    if (!auth.success) {
      return NextResponse.json(
        { error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'No autenticado' },
        { status: 401 }
      )
    }

    // Verify admin
    if (!isAdmin(auth.email)) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      )
    }

    const result = await getCachedEngagementStats()

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/admin/engagement-stats] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/admin/engagement-stats', _GET)
