// app/api/admin/oep-signals/pending-count/route.ts
// Count para badge admin (polling cada 30s)
import { NextRequest, NextResponse } from 'next/server'
import { getPendingSignalsCount } from '@/lib/api/oep-signals/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 10

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const result = await getPendingSignalsCount()
    return NextResponse.json(result)
  } catch (err) {
    console.error('❌ [API/admin/oep-signals/pending-count] Error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error', pendingCount: 0, criticalCount: 0 },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/admin/oep-signals/pending-count', _GET)
