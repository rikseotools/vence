// app/api/v2/admin/feedback/user-conversations/route.ts
// Otras conversaciones de un usuario (excluyendo la actual) para el panel de
// /admin/feedback. Tier admin. AGNÓSTICO (Fase C1): sustituye el embed PostgREST
// feedback:user_feedback(...) por Drizzle (JOIN + json_build_object).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const url = new URL(request.url)
  const userId = url.searchParams.get('userId')
  const excludeId = url.searchParams.get('excludeId')
  if (!z.string().uuid().safeParse(userId).success) {
    return NextResponse.json({ success: false, error: 'invalid_userId' }, { status: 400 })
  }
  const exclude = z.string().uuid().safeParse(excludeId).success ? excludeId : null

  const res = await getAdminDb().execute(sql`
    SELECT fc.*,
      json_build_object('id', uf.id, 'message', uf.message, 'type', uf.type,
                        'created_at', uf.created_at, 'status', uf.status) AS feedback
    FROM feedback_conversations fc
    LEFT JOIN user_feedback uf ON uf.id = fc.feedback_id
    WHERE fc.user_id = ${userId}::uuid
      AND (${exclude}::uuid IS NULL OR fc.id <> ${exclude}::uuid)
    ORDER BY fc.last_message_at DESC
    LIMIT 10
  `)
  const conversations = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  return NextResponse.json({ success: true, conversations })
}

export const GET = withErrorLogging('/api/v2/admin/feedback/user-conversations', _GET)
