import { NextRequest, NextResponse } from 'next/server'
import { getEpigrafeDetail } from '@/lib/api/admin-contenido/queries'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 20
export const dynamic = 'force-dynamic'

// Drill-down de epígrafe (S2): detalle tema a tema de una oposición.
async function _GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const { slug } = await ctx.params
  try {
    const data = await getEpigrafeDetail(slug)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Error' },
      { status: 500 },
    )
  }
}

export const GET = withErrorLogging('/api/admin/contenido/epigrafe/[slug]', _GET)
