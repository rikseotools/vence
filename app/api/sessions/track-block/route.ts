// app/api/sessions/track-block/route.ts
// Registra bloqueo por simultaneidad en session_block_events + fraud_alerts
import { NextRequest, NextResponse } from 'next/server'

import { getAdminDb } from '@/db/client'
import { sessionBlockEvents, fraudAlerts } from '@/db/schema'
import { and, eq, gte, arrayContains } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

interface TrackBlockRequest {
  sessionsCount: number
}

function getClientIp(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? null
}

async function _POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/sessions/track-block')
    if (!auth.success) {
      return NextResponse.json(
        { error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Usuario no autenticado' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    const body: TrackBlockRequest = await request.json()
    const { sessionsCount } = body
    const ip = getClientIp(request)

    const db = getAdminDb()

    // 1. Registrar en session_block_events
    try {
      await db
        .insert(sessionBlockEvents)
        .values({
          userId: user.id!,
          sessionsCount: sessionsCount || 0,
          blockedAt: new Date().toISOString()
        })
    } catch (insertError) {
      // 42P01 = tabla inexistente (defensivo, por si aún no migrada): ignorar
      if ((insertError as { code?: string })?.code !== '42P01') {
        console.error('[SessionBlock] Error insertando evento:', insertError)
      }
    }

    // 2. Registrar en fraud_alerts (dedup: no crear si ya hay una alerta
    //    del mismo tipo + usuario + status 'new' en las últimas 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const existingAlerts = await db
      .select({ id: fraudAlerts.id })
      .from(fraudAlerts)
      .where(and(
        eq(fraudAlerts.alertType, 'simultaneous_session'),
        eq(fraudAlerts.status, 'new'),
        arrayContains(fraudAlerts.userIds, [user.id!]),
        gte(fraudAlerts.detectedAt, twentyFourHoursAgo),
      ))
      .limit(1)

    if (!existingAlerts || existingAlerts.length === 0) {
      try {
        await db
          .insert(fraudAlerts)
          .values({
            alertType: 'simultaneous_session',
            severity: 'high',
            status: 'new',
            userIds: [user.id!],
            details: {
              email: user.email,
              sessions_count: sessionsCount,
              blocked_ip: ip,
              blocked_at: new Date().toISOString()
            },
            matchCriteria: `Uso simultáneo desde IPs distintas (${sessionsCount} sesiones)`
          })
        console.log(`[SessionBlock] Fraud alert creada para ${user.email}`)
      } catch (alertError) {
        console.error('[SessionBlock] Error creando fraud_alert:', alertError)
      }
    }

    console.log(`[SessionBlock] Bloqueo registrado para ${user.email} (${sessionsCount} sesiones, IP: ${ip})`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[SessionBlock] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/sessions/track-block', _POST)
