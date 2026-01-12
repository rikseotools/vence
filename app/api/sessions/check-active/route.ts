// app/api/sessions/check-active/route.ts
// API para verificar sesiones activas de un usuario bajo control
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Lista de emails bajo control de sesiones simultáneas
const CONTROLLED_EMAILS: string[] = [
  'edu77santoyo@gmail.com'
]

interface SessionData {
  id: string
  session_start: string
  ip_address: string | null
  city: string | null
  screen_resolution: string | null
  user_agent: string | null
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
  error?: string
}

export async function GET(request: NextRequest): Promise<NextResponse<CheckActiveResponse>> {
  try {
    // Obtener el token de autenticación
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        isControlled: false,
        hasOtherSessions: false,
        error: 'No autorizado'
      }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]

    // Crear cliente de Supabase con el token del usuario
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    )

    // Obtener usuario actual
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        isControlled: false,
        hasOtherSessions: false,
        error: 'Usuario no autenticado'
      }, { status: 401 })
    }

    // Verificar si el usuario está en la lista de control
    if (!user.email || !CONTROLLED_EMAILS.includes(user.email)) {
      return NextResponse.json({
        isControlled: false,
        hasOtherSessions: false,
        sessions: []
      })
    }

    // Usar service role para consultar sesiones (bypass RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar sesiones activas (sin session_end) de las últimas 24 horas
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: sessions, error: sessionsError } = await supabaseAdmin
      .from('user_sessions')
      .select('id, session_start, ip_address, city, screen_resolution, user_agent')
      .eq('user_id', user.id)
      .is('session_end', null)
      .gte('session_start', twentyFourHoursAgo)
      .order('session_start', { ascending: false })

    if (sessionsError) {
      console.error('Error consultando sesiones:', sessionsError)
      return NextResponse.json({
        isControlled: true,
        hasOtherSessions: false,
        error: 'Error consultando sesiones'
      }, { status: 500 })
    }

    // Formatear sesiones para el frontend
    const formattedSessions: FormattedSession[] = (sessions as SessionData[] || []).map(s => ({
      id: s.id,
      startedAt: s.session_start,
      ip: s.ip_address,
      city: s.city || 'Desconocida',
      device: formatDevice(s.screen_resolution, s.user_agent)
    }))

    // Obtener ID de sesión actual desde query param o header
    const currentSessionId = request.headers.get('x-session-id') ||
                            new URL(request.url).searchParams.get('currentSessionId')

    // Filtrar otras sesiones (excluir la actual si se proporciona)
    const otherSessions = currentSessionId
      ? formattedSessions.filter(s => s.id !== currentSessionId)
      : formattedSessions.slice(1) // Asumir que la más reciente es la actual

    return NextResponse.json({
      isControlled: true,
      hasOtherSessions: otherSessions.length > 0,
      totalSessions: formattedSessions.length,
      otherSessionsCount: otherSessions.length,
      sessions: otherSessions,
      currentSessionId: currentSessionId || formattedSessions[0]?.id
    })

  } catch (error) {
    console.error('Error en check-active:', error)
    return NextResponse.json({
      isControlled: false,
      hasOtherSessions: false,
      error: 'Error interno'
    }, { status: 500 })
  }
}

// Helper para formatear información del dispositivo
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
