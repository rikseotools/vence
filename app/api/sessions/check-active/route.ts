// app/api/sessions/check-active/route.ts
// Detecta uso simultáneo real desde IPs distintas (últimos 15 min con actividad)
import { NextRequest, NextResponse } from 'next/server'

import { getAdminDb } from '@/db/client'
import { userSessions } from '@/db/schema'
import { and, eq, isNull, gte, gt, desc } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

const CONTROLLED_EMAILS: string[] = [
  'edu77santoyo@gmail.com'
]

const SIMULTANEITY_WINDOW_MINUTES = 15

interface SessionData {
  id: string
  session_start: string
  ip_address: string | null
  city: string | null
  screen_resolution: string | null
  user_agent: string | null
  questions_answered: number | null
}

interface FormattedSession {
  id: string
  startedAt: string
  ip: string | null
  city: string
  device: string
}

interface CheckActiveResponse {
  isControlled: boolean
  hasOtherSessions: boolean
  totalSessions?: number
  otherSessionsCount?: number
  sessions?: FormattedSession[]
  currentSessionId?: string
  currentIp?: string
  error?: string
}

function getClientIp(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? null
}

async function _GET(request: NextRequest): Promise<NextResponse<CheckActiveResponse>> {
  try {
    // Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/sessions/check-active')
    if (!auth.success) {
      return NextResponse.json({
        isControlled: false,
        hasOtherSessions: false,
        error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Usuario no autenticado'
      }, { status: 401 })
    }
    const user = { id: auth.userId, email: auth.email }

    if (!user.email || !CONTROLLED_EMAILS.includes(user.email)) {
      return NextResponse.json({
        isControlled: false,
        hasOtherSessions: false,
        sessions: []
      })
    }

    const currentIp = getClientIp(request)
    const windowStart = new Date(Date.now() - SIMULTANEITY_WINDOW_MINUTES * 60 * 1000).toISOString()

    // Sesiones activas con actividad real en los últimos 15 min
    let sessions = null
    let sessionsError = null
    try {
      sessions = await getAdminDb()
        .select({
          id: userSessions.id,
          session_start: userSessions.sessionStart,
          ip_address: userSessions.ipAddress,
          city: userSessions.city,
          screen_resolution: userSessions.screenResolution,
          user_agent: userSessions.userAgent,
          questions_answered: userSessions.questionsAnswered,
        })
        .from(userSessions)
        .where(and(
          eq(userSessions.userId, user.id),
          isNull(userSessions.sessionEnd),
          gte(userSessions.sessionStart, windowStart),
          gt(userSessions.questionsAnswered, 0),
        ))
        .orderBy(desc(userSessions.sessionStart))
    } catch (e) {
      sessionsError = e
    }

    if (sessionsError) {
      console.error('[SessionControl] Error consultando sesiones:', sessionsError)
      return NextResponse.json({
        isControlled: true,
        hasOtherSessions: false,
        error: 'Error consultando sesiones'
      }, { status: 500 })
    }

    const typedSessions = (sessions as unknown as SessionData[]) || []

    // Filtrar sesiones desde IPs DISTINTAS a la actual
    const sessionsFromOtherIps = currentIp
      ? typedSessions.filter(s => s.ip_address && s.ip_address !== currentIp)
      : []

    const formattedOtherSessions: FormattedSession[] = sessionsFromOtherIps.map(s => ({
      id: s.id,
      startedAt: s.session_start,
      ip: s.ip_address,
      city: s.city || 'Desconocida',
      device: formatDevice(s.screen_resolution, s.user_agent)
    }))

    const hasSimultaneousFromOtherIp = formattedOtherSessions.length > 0

    if (hasSimultaneousFromOtherIp) {
      console.log(
        `[SessionControl] Simultaneidad detectada para ${user.email}: ` +
        `IP actual=${currentIp}, otras IPs=[${sessionsFromOtherIps.map(s => s.ip_address).join(', ')}]`
      )
    }

    return NextResponse.json({
      isControlled: true,
      hasOtherSessions: hasSimultaneousFromOtherIp,
      totalSessions: typedSessions.length,
      otherSessionsCount: formattedOtherSessions.length,
      sessions: formattedOtherSessions,
      currentIp: currentIp ?? undefined
    })

  } catch (error) {
    console.error('[SessionControl] Error en check-active:', error)
    return NextResponse.json({
      isControlled: false,
      hasOtherSessions: false,
      error: 'Error interno'
    }, { status: 500 })
  }
}

function formatDevice(resolution: string | null, userAgent: string | null): string {
  if (!resolution && !userAgent) return 'Dispositivo desconocido'

  let os = 'Otro'
  if (userAgent) {
    if (userAgent.includes('iPhone')) os = 'iPhone'
    else if (userAgent.includes('iPad')) os = 'iPad'
    else if (userAgent.includes('Android')) os = 'Android'
    else if (userAgent.includes('Mac OS')) os = 'Mac'
    else if (userAgent.includes('Windows')) os = 'Windows'
    else if (userAgent.includes('Linux')) os = 'Linux'
  }

  return resolution ? `${resolution} / ${os}` : os
}

export const GET = withErrorLogging('/api/sessions/check-active', _GET)
