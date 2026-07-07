import { NextRequest, NextResponse } from 'next/server'
import { getContenidoCount } from '@/lib/api/admin-contenido/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

// Badge del nav: oposiciones con temas "En desarrollo" (0 preguntas).
async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  try {
    const data = await getContenidoCount()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/admin/contenido/count', _GET)
