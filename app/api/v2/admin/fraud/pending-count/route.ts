// app/api/v2/admin/fraud/pending-count/route.ts
// Contador del BADGE de la pestaña Fraudes: señales sin revisar (fraud_alerts status='new').
// Mismo patrón que /api/admin/oep-signals/pending-count. Alimenta app/admin/layout.tsx.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15
function rows(r: unknown): any[] {
  return (Array.isArray(r) ? r : (r as { rows?: unknown[] }).rows || []) as any[]
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const db = getAdminDb()
  const r = rows(await db.execute(sql`
    SELECT count(*)::int AS pending,
           count(*) FILTER (WHERE severity = 'critical')::int AS critical
    FROM fraud_alerts WHERE status = 'new'
  `))[0] || { pending: 0, critical: 0 }
  return NextResponse.json({ success: true, count: Number(r.pending), critical: Number(r.critical) })
}
export const GET = withErrorLogging('/api/v2/admin/fraud/pending-count', _GET)
