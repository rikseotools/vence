// app/api/v2/disputes/appeal/route.ts
// Envía una alegación para una impugnación RECHAZADA del usuario AUTENTICADO
// (hook useDisputeNotifications.submitAppeal).
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('question_disputes').update de
// cliente por Drizzle. El user_id sale SIEMPRE del TOKEN; el WHERE exige además
// status='rejected' → un usuario solo puede alegar SUS impugnaciones rechazadas.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  disputeId: z.string().uuid(),
  appealText: z.string().trim().min(1),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/disputes/appeal')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const { disputeId, appealText } = parsed.data

  const res = await getAdminDb().execute(sql`
    UPDATE question_disputes
    SET appeal_text = ${appealText},
        appeal_submitted_at = now(),
        status = 'appealed'
    WHERE id = ${disputeId}::uuid
      AND user_id = ${auth.userId}::uuid
      AND status = 'rejected'
    RETURNING id
  `)
  const updated = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []).length > 0

  return NextResponse.json({ success: updated, updated })
}

export const POST = withErrorLogging('/api/v2/disputes/appeal', _POST)
