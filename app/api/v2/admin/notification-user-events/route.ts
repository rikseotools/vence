// app/api/v2/admin/notification-user-events/route.ts
// Eventos push + email de UN usuario (últimos 30d) para el detalle de
// /admin/notificaciones/users. Tier admin.
//
// AGNÓSTICO (Fase C1): sustituye 2 supabase.from de cliente por Drizzle detrás de
// requireAdmin. Datos de un usuario arbitrario → solo admin (no es self-scoped).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const userId = new URL(request.url).searchParams.get('userId')
  if (!z.string().uuid().safeParse(userId).success) {
    return NextResponse.json({ success: false, error: 'invalid_userId' }, { status: 400 })
  }
  const db = getAdminDb()

  const pushEvents = rowsOf(await db.execute(sql`
    SELECT * FROM notification_events
    WHERE user_id = ${userId}::uuid AND created_at >= now() - interval '30 days'
    ORDER BY created_at DESC
  `))
  const emailEvents = rowsOf(await db.execute(sql`
    SELECT * FROM email_events
    WHERE user_id = ${userId}::uuid AND created_at >= now() - interval '30 days'
    ORDER BY created_at DESC
  `))

  return NextResponse.json({ success: true, pushEvents, emailEvents })
}

export const GET = withErrorLogging('/api/v2/admin/notification-user-events', _GET)
