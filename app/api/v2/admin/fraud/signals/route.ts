// app/api/v2/admin/fraud/signals/route.ts
// Lista las SEÑALES de fraude del sweep (fraud_alerts) para el panel + para que Claude las
// revise con el runbook docs/runbooks/revisar-fraudes.md. Filtra por ?status= (default new).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 25
function rows(r: unknown): any[] {
  return (Array.isArray(r) ? r : (r as { rows?: unknown[] }).rows || []) as any[]
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const db = getAdminDb()
  const status = new URL(request.url).searchParams.get('status') || 'new'
  const signals = rows(await db.execute(sql`
    SELECT id, alert_type, severity, status, user_ids, details, match_criteria,
           detected_at, reviewed_at, notes
    FROM fraud_alerts
    WHERE status = ${status}
    ORDER BY (severity = 'critical') DESC, (severity = 'high') DESC, detected_at DESC
    LIMIT 300
  `))
  return NextResponse.json({ success: true, signals })
}
export const GET = withErrorLogging('/api/v2/admin/fraud/signals', _GET)
