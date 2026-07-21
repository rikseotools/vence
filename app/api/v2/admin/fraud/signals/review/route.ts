// app/api/v2/admin/fraud/signals/review/route.ts
// Marca una señal de fraude como revisada. action ∈ {reviewed, dismissed, confirmed}:
//   - dismissed = falso positivo (uso legítimo)
//   - confirmed = fraude real (queda registrado; el enforcement/bloqueo es aparte)
//   - reviewed  = vista y anotada, sin veredicto duro
// Sale del badge en cuanto deja de estar 'new'. reviewed_by = admin del token.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15
const ACTIONS = new Set(['reviewed', 'dismissed', 'confirmed'])

async function _POST(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response
  const body = await request.json().catch(() => ({}))
  const { id, action, notes } = body as { id?: string; action?: string; notes?: string }
  if (!id || !action || !ACTIONS.has(action)) {
    return NextResponse.json({ success: false, error: 'id y action (reviewed|dismissed|confirmed) requeridos' }, { status: 400 })
  }
  const db = getAdminDb()
  const reviewer = admin.user?.id ?? null
  await db.execute(sql`
    UPDATE fraud_alerts
    SET status = ${action}, reviewed_at = now(),
        reviewed_by = ${reviewer}::uuid,
        notes = COALESCE(${notes ?? null}, notes)
    WHERE id = ${id}::uuid
  `)
  return NextResponse.json({ success: true, id, status: action })
}
export const POST = withErrorLogging('/api/v2/admin/fraud/signals/review', _POST)
