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
import { and, eq, isNull, sql, inArray } from 'drizzle-orm'
import { getOposicionAlertsFeed } from '@/lib/api/notifications/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 10

// GET → avisos VIVOS del usuario (los cerrados no vuelven: T-480).
async function _GET(request: NextRequest) {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth.response

  const { data, unreadCount } = await getOposicionAlertsFeed(auth.user.id)

  return NextResponse.json({ success: true, data, unreadCount })
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
