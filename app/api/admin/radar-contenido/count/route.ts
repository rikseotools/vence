import { NextRequest, NextResponse } from 'next/server'
import { getRadarContenidoCount } from '@/lib/api/radar-contenido/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

// Badge del nav: nº de recomendaciones nuevas sin ver.
async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  try {
    const data = await getRadarContenidoCount()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/admin/radar-contenido/count', _GET)
