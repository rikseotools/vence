import { NextRequest, NextResponse } from 'next/server'
import {
  getRadarContenido,
  markRadarSeen,
} from '@/lib/api/radar-contenido/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 15
export const dynamic = 'force-dynamic'

// GET: lista de top posts del radar de contenido.
async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  try {
    const data = await getRadarContenido()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    )
  }
}

// POST: marcar como vistas (baja el badge).
async function _POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  try {
    const data = await markRadarSeen()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/admin/radar-contenido', _GET)
export const POST = withErrorLogging('/api/admin/radar-contenido', _POST)
