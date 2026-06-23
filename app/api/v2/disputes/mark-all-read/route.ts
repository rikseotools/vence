// app/api/v2/disputes/mark-all-read/route.ts
// Marca como leídas TODAS las notificaciones de impugnaciones resueltas del usuario
// AUTENTICADO (hook useDisputeNotifications.markAllAsRead), normales + psicotécnicas.
//
// AGNÓSTICO (Fase C1): sustituye 2 supabase.from(...).update de cliente por Drizzle.
// El user_id sale SIEMPRE del TOKEN → imposible marcar impugnaciones de otro usuario.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/disputes/mark-all-read')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  const uid = auth.userId
  const db = getAdminDb()

  await db.execute(sql`
    UPDATE question_disputes SET is_read = true
    WHERE user_id = ${uid}::uuid
      AND status IN ('resolved', 'rejected', 'appealed')
      AND is_read = false
  `)
  await db.execute(sql`
    UPDATE psychometric_question_disputes SET is_read = true
    WHERE user_id = ${uid}::uuid
      AND status IN ('resolved', 'rejected')
      AND is_read = false
  `)

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/disputes/mark-all-read', _POST)
