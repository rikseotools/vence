import { NextRequest, NextResponse } from 'next/server'
import { getContenidoOverview } from '@/lib/api/admin-contenido/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 20
export const dynamic = 'force-dynamic'

// Estado de completitud de contenido por oposición.
async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  try {
    const data = await getContenidoOverview()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/admin/contenido', _GET)
