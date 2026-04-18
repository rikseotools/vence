// app/api/sessions/track-block/route.ts
// Registra bloqueo por simultaneidad en session_block_events + fraud_alerts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { withErrorLogging } from '@/lib/api/withErrorLogging'

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
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const body: TrackBlockRequest = await request.json()
    const { sessionsCount } = body
    const ip = getClientIp(request)

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Registrar en session_block_events
    const { error: insertError } = await supabaseAdmin
      .from('session_block_events')
      .insert({
        user_id: user.id,
        sessions_count: sessionsCount || 0,
        blocked_at: new Date().toISOString()
      })

    if (insertError && insertError.code !== '42P01') {
      console.error('[SessionBlock] Error insertando evento:', insertError)
    }

    // 2. Registrar en fraud_alerts (dedup: no crear si ya hay una alerta
    //    del mismo tipo + usuario + status 'new' en las últimas 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: existingAlerts } = await supabaseAdmin
      .from('fraud_alerts')
      .select('id')
      .eq('alert_type', 'simultaneous_session')
      .eq('status', 'new')
      .contains('user_ids', [user.id])
      .gte('detected_at', twentyFourHoursAgo)
      .limit(1)

    if (!existingAlerts || existingAlerts.length === 0) {
      const { error: alertError } = await supabaseAdmin
        .from('fraud_alerts')
        .insert({
          alert_type: 'simultaneous_session',
          severity: 'high',
          status: 'new',
          user_ids: [user.id],
          details: {
            email: user.email,
            sessions_count: sessionsCount,
            blocked_ip: ip,
            blocked_at: new Date().toISOString()
          },
          match_criteria: `Uso simultáneo desde IPs distintas (${sessionsCount} sesiones)`
        })

      if (alertError) {
        console.error('[SessionBlock] Error creando fraud_alert:', alertError)
      } else {
        console.log(`[SessionBlock] Fraud alert creada para ${user.email}`)
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
