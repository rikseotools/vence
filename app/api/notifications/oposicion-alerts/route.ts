// app/api/notifications/oposicion-alerts/route.ts
// Fase 8 (8c): feed de la campana — avisos por hito verificado de las
// oposiciones que sigue el usuario (target + favoritas).
//
// userId SIEMPRE de la sesión (getAuthenticatedUser) → sin IDOR.
// RLS-lockdown en user_oposicion_alerts → acceso solo por getAdminDb.
// Observabilidad ante fallo vía withErrorLogging (emit -> observable_events).

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { userOposicionAlerts } from '@/db/schema'
import { and, eq, isNull, sql, desc, inArray } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 10

const FEED_LIMIT = 30

// GET → últimos avisos del usuario + nº no leídos.
async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const db = getAdminDb()
  const rows = await db
    .select({
      id: userOposicionAlerts.id,
      oposicionId: userOposicionAlerts.oposicionId,
      hitoId: userOposicionAlerts.hitoId,
      titulo: userOposicionAlerts.titulo,
      descripcion: userOposicionAlerts.descripcion,
      severity: userOposicionAlerts.severity,
      url: userOposicionAlerts.url,
      readAt: userOposicionAlerts.readAt,
      createdAt: userOposicionAlerts.createdAt,
    })
    .from(userOposicionAlerts)
    .where(eq(userOposicionAlerts.userId, auth.user.id))
    .orderBy(desc(userOposicionAlerts.createdAt))
    .limit(FEED_LIMIT)

  const unreadCount = rows.filter((r) => r.readAt == null).length

  return NextResponse.json({ success: true, data: rows, unreadCount })
}

// PATCH { ids?: string[] } → marca leídos esos avisos; sin ids = todos los no leídos.
async function _PATCH(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const ids = Array.isArray((body as { ids?: unknown }).ids)
    ? ((body as { ids: unknown[] }).ids.filter((x) => typeof x === 'string') as string[])
    : null

  const db = getAdminDb()
  const base = and(
    eq(userOposicionAlerts.userId, auth.user.id),
    isNull(userOposicionAlerts.readAt),
  )
  await db
    .update(userOposicionAlerts)
    .set({ readAt: sql`now()` })
    .where(ids && ids.length > 0 ? and(base, inArray(userOposicionAlerts.id, ids)) : base)

  return NextResponse.json({ success: true })
}

export const GET = withErrorLogging('/api/notifications/oposicion-alerts', _GET)
export const PATCH = withErrorLogging('/api/notifications/oposicion-alerts', _PATCH)
