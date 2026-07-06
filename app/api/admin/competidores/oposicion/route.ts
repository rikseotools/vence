import { NextRequest, NextResponse } from 'next/server'
import { getCompetitorsForOposicion } from '@/lib/api/competitors/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ success: false, error: 'falta id' }, { status: 400 })
  const result = await getCompetitorsForOposicion(id)
  return NextResponse.json(result)
}

export const GET = withErrorLogging('/api/admin/competidores/oposicion', _GET)
