import { NextRequest, NextResponse } from 'next/server'
import { getCompetitorsOverview } from '@/lib/api/competitors/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const result = await getCompetitorsOverview()
  return NextResponse.json(result)
}

export const GET = withErrorLogging('/api/admin/competidores', _GET)
