// app/api/admin/scope-verification/count/route.ts
// Badge del nav (Contenido): temas con topic_scope sin verificar / cambiado / con issues.
import { NextRequest, NextResponse } from 'next/server'
import { getScopeVerificationCount } from '@/lib/api/scope-verification/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const data = await getScopeVerificationCount()
  return NextResponse.json(data, { status: data.success ? 200 : 500 })
}

export const GET = withErrorLogging('/api/admin/scope-verification/count', _GET)
