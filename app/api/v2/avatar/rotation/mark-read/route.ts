// app/api/v2/avatar/rotation/mark-read/route.ts
// Marca la notificación de rotación de avatar como leída (rotation_notification_pending=false)
// para el usuario AUTENTICADO. useIntelligentNotifications.markAvatarNotificationAsRead.
// AGNÓSTICO (Fase C1): sustituye supabase.from('user_avatar_settings').update de cliente.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/avatar/rotation/mark-read')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  await getAdminDb().execute(sql`
    UPDATE user_avatar_settings SET rotation_notification_pending = false
    WHERE user_id = ${auth.userId}::uuid
  `)
  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/avatar/rotation/mark-read', _POST)
