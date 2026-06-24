// app/api/v2/admin/feedback/start-conversation/route.ts
// Crea una conversación iniciada por admin para un feedback (botón "iniciar chat").
// Tier admin. AGNÓSTICO (Fase C1): sustituye el INSERT de cliente; admin_id sale
// del TOKEN (requireAdmin), no del body.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  feedbackId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const { feedbackId, userId } = parsed.data

  // NOTA: el INSERT del cliente original usaba columnas inexistentes (admin_id,
  // started_by_admin) → estaba ROTO (PGRST204). Aquí se usan las columnas reales:
  // admin_user_id (FK a user_profiles). started_by_admin no existe → se omite.
  const res = await getAdminDb().execute(sql`
    INSERT INTO feedback_conversations (feedback_id, user_id, status, admin_user_id)
    VALUES (${feedbackId}::uuid, ${userId}::uuid, 'waiting_admin', ${admin.user.id}::uuid)
    RETURNING *
  `)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  return NextResponse.json({ success: true, conversation: rows[0] ?? null })
}

export const POST = withErrorLogging('/api/v2/admin/feedback/start-conversation', _POST)
