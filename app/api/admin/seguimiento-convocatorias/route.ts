// app/api/admin/seguimiento-convocatorias/route.ts
// API para la vista admin de seguimiento de convocatorias

import { NextRequest, NextResponse } from 'next/server'
import {
  getSeguimientoAdminData,
  markSeguimientoReviewed,
} from '@/lib/api/seguimiento-convocatorias/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

// GET: obtener datos para la vista admin
async function _GET() {
  try {
    const data = await getSeguimientoAdminData()
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

// POST: marcar como revisado
async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, oposicionId } = body

    if (action === 'mark_reviewed' && oposicionId) {
      await markSeguimientoReviewed(oposicionId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/admin/seguimiento-convocatorias', _GET)
export const POST = withErrorLogging('/api/admin/seguimiento-convocatorias', _POST)
