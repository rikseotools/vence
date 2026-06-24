// app/api/v2/notifications/mark-read/route.ts
// Marca UNA notificación de sistema (notification_logs) como abierta. Usuario AUTENTICADO.
// AGNÓSTICO (Fase C1): sustituye supabase.from('notification_logs').update de cliente.
// El WHERE incluye user_id del TOKEN → solo se marcan las propias.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({ notificationId: z.string().uuid() })

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/notifications/mark-read')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }

  await getAdminDb().execute(sql`
    UPDATE notification_logs SET opened_at = now()
    WHERE id = ${parsed.data.notificationId}::uuid AND user_id = ${auth.userId}::uuid
  `)
  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/notifications/mark-read', _POST)
