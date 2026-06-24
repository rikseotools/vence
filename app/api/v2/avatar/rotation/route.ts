// app/api/v2/avatar/rotation/route.ts
// Notificación de rotación de avatar del usuario AUTENTICADO: ajustes + perfil actual.
// useIntelligentNotifications.loadAvatarRotationNotifications.
//
// AGNÓSTICO (Fase C1): sustituye 2 supabase.from de cliente (user_avatar_settings +
// avatar_profiles) por Drizzle. user_id del TOKEN. Devuelve { avatarSettings, profile }
// (profile solo si hay rotación pendiente); el cliente arma la notificación.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/avatar/rotation')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  const db = getAdminDb()

  const sres = await db.execute(sql`SELECT * FROM user_avatar_settings WHERE user_id = ${auth.userId}::uuid LIMIT 1`)
  const avatarSettings = rowsOf(sres)[0] as { rotation_notification_pending?: boolean; current_profile?: string } | undefined
  if (!avatarSettings || !avatarSettings.rotation_notification_pending) {
    return NextResponse.json({ success: true, avatarSettings: null, profile: null })
  }

  const pres = await db.execute(sql`
    SELECT emoji, name_es, description_es FROM avatar_profiles WHERE id = ${avatarSettings.current_profile} LIMIT 1
  `)
  const profile = rowsOf(pres)[0] ?? null

  return NextResponse.json({ success: true, avatarSettings, profile })
}

export const GET = withErrorLogging('/api/v2/avatar/rotation', _GET)
