// app/api/v2/admin/feedback/conversation-feedback-id/route.ts
// Devuelve el feedback_id de una conversación. Tier admin.
// AGNÓSTICO (Fase C1): sustituye un SELECT puntual de cliente por Drizzle.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const conversationId = new URL(request.url).searchParams.get('conversationId')
  if (!conversationId) {
    return NextResponse.json({ success: false, error: 'missing_conversationId' }, { status: 400 })
  }

  const res = await getAdminDb().execute(sql`
    SELECT feedback_id FROM feedback_conversations WHERE id = ${conversationId}::uuid LIMIT 1
  `)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  return NextResponse.json({ success: true, feedbackId: (rows[0] as { feedback_id?: string } | undefined)?.feedback_id ?? null })
}

export const GET = withErrorLogging('/api/v2/admin/feedback/conversation-feedback-id', _GET)
