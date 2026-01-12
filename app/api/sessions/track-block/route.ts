// app/api/sessions/track-block/route.ts
// API para registrar cuando un usuario ve el modal de bloqueo por sesiones múltiples
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

interface TrackBlockRequest {
  sessionsCount: number
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Obtener el token de autenticación
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
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
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    // Obtener datos del body
    const body: TrackBlockRequest = await request.json()
    const { sessionsCount } = body

    // Usar service role para insertar el evento
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Insertar evento de bloqueo
    const { error: insertError } = await supabaseAdmin
      .from('session_block_events')
      .insert({
        user_id: user.id,
        sessions_count: sessionsCount || 0,
        blocked_at: new Date().toISOString()
      })

    if (insertError) {
      // Si la tabla no existe, crearla e intentar de nuevo
      if (insertError.code === '42P01') {
        console.log('[SessionBlock] Tabla no existe, creándola...')
        // La tabla se creará manualmente
        return NextResponse.json({
          success: false,
          error: 'Tabla session_block_events no existe. Crear con migración.'
        }, { status: 500 })
      }

      console.error('[SessionBlock] Error insertando evento:', insertError)
      return NextResponse.json({ error: 'Error registrando evento' }, { status: 500 })
    }

    console.log(`[SessionBlock] Registrado bloqueo para ${user.email} (${sessionsCount} sesiones)`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[SessionBlock] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
