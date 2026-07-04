// app/api/admin/radar-salud/route.ts
// GET: salud del radar multi-capa (por adapter, gaps, degradados).
import { NextRequest, NextResponse } from 'next/server'
import { getRadarHealth } from '@/lib/api/radar-salud/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 15
export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const data = await getRadarHealth()
    return NextResponse.json(data)
  } catch (err) {
    console.error('❌ [API/admin/radar-salud] error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/admin/radar-salud', _GET)
