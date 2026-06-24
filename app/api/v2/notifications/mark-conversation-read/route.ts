// app/api/v2/notifications/mark-conversation-read/route.ts
// Marca como leídas las notificaciones del usuario AUTENTICADO asociadas a una
// conversación (página /soporte al abrir un hilo).
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('notification_logs').update de
// cliente por Drizzle. user_id SIEMPRE del TOKEN → imposible marcar las de otro.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  conversationId: z.string().min(1),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/notifications/mark-conversation-read')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }

  await getAdminDb().execute(sql`
    UPDATE notification_logs
    SET opened_at = now()
    WHERE user_id = ${auth.userId}::uuid
      AND opened_at IS NULL
      AND context_data @> ${JSON.stringify({ conversation_id: parsed.data.conversationId })}::jsonb
  `)

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/notifications/mark-conversation-read', _POST)
