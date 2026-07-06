import { NextRequest, NextResponse } from 'next/server'
import { getCompetitorReviewQueue, confirmCompetitorMatch } from '@/lib/api/competitors/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const result = await getCompetitorReviewQueue()
  return NextResponse.json(result)
}

async function _POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const body = (await request.json().catch(() => null)) as
    | { courseId?: string; oposicionId?: string | null }
    | null
  if (!body?.courseId) {
    return NextResponse.json({ success: false, error: 'courseId requerido' }, { status: 400 })
  }
  await confirmCompetitorMatch(body.courseId, body.oposicionId ?? null)
  return NextResponse.json({ success: true })
}

export const GET = withErrorLogging('/api/admin/competidores/review', _GET)
export const POST = withErrorLogging('/api/admin/competidores/review', _POST)
