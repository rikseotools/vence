import { NextRequest, NextResponse } from 'next/server'
import { getCompetitorChangesCount } from '@/lib/api/competitors/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const result = await getCompetitorChangesCount()
  return NextResponse.json(result)
}

export const GET = withErrorLogging('/api/admin/competidores/changes-count', _GET)
