// app/api/v2/admin/feedback/update-feedback/route.ts
// Actualiza estado/respuesta de un user_feedback desde /admin/feedback. Tier admin.
// AGNÓSTICO (Fase C1): sustituye supabase.from('user_feedback').update de cliente.
// El admin_user_id sale del TOKEN (requireAdmin), no del body.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  feedbackId: z.string().uuid(),
  status: z.string().min(1).max(40),
  adminResponse: z.string().nullish(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const { feedbackId, status, adminResponse } = parsed.data
  const resolved = (status === 'resolved' || status === 'dismissed')

  // admin_response/admin_user_id solo si hay respuesta; resolved_at solo si resuelto.
  // Columnas literales (sin interpolar nombres), condicionales con COALESCE/CASE.
  const res = await getAdminDb().execute(sql`
    UPDATE user_feedback
    SET status = ${status},
        updated_at = now(),
        admin_response = CASE WHEN ${adminResponse ?? null}::text IS NOT NULL THEN ${adminResponse ?? null} ELSE admin_response END,
        admin_user_id = CASE WHEN ${adminResponse ?? null}::text IS NOT NULL THEN ${admin.user.id}::uuid ELSE admin_user_id END,
        resolved_at = CASE WHEN ${resolved} THEN now() ELSE resolved_at END
    WHERE id = ${feedbackId}::uuid
    RETURNING id
  `)
  const ok = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []).length > 0
  return NextResponse.json({ success: ok })
}

export const POST = withErrorLogging('/api/v2/admin/feedback/update-feedback', _POST)
