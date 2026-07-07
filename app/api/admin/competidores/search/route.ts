import { NextRequest, NextResponse } from 'next/server'
import { searchCatalogAndGaps } from '@/lib/api/competitors/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ success: true, oposiciones: [], gaps: [] })
  const result = await searchCatalogAndGaps(q)
  return NextResponse.json(result)
}

export const GET = withErrorLogging('/api/admin/competidores/search', _GET)
