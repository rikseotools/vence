import { NextRequest, NextResponse } from 'next/server'
import { getRolloverPending } from '@/lib/api/oposiciones/rollover'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 10

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const result = await getRolloverPending()
  return NextResponse.json({ ...result, count: result.items.length })
}

export const GET = withErrorLogging('/api/admin/oposiciones/rollover-pending', _GET)
