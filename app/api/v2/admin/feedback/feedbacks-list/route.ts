// app/api/v2/admin/feedback/feedbacks-list/route.ts
// Lista completa de user_feedback (más recientes primero) para /admin/feedback.
// Tier admin. AGNÓSTICO (Fase C1): sustituye SELECT * de cliente por Drizzle.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 20

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const res = await getAdminDb().execute(sql`SELECT * FROM user_feedback ORDER BY created_at DESC`)
  const feedbacks = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  return NextResponse.json({ success: true, feedbacks })
}

export const GET = withErrorLogging('/api/v2/admin/feedback/feedbacks-list', _GET)
