import { NextRequest, NextResponse } from 'next/server'
import { acknowledgeCompetitorChanges } from '@/lib/api/competitors/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

/** Marca señales como revisadas. Body: { id } para una, {} para todas las pendientes. */
async function _POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const body = (await request.json().catch(() => ({}))) as { id?: string }
  const n = await acknowledgeCompetitorChanges(body.id)
  return NextResponse.json({ success: true, acknowledged: n })
}

export const POST = withErrorLogging('/api/admin/competidores/changes', _POST)
