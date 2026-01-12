// app/api/sessions/close-others/route.ts
// API para cerrar todas las sesiones excepto la actual
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Lista de emails bajo control de sesiones simultáneas
const CONTROLLED_EMAILS: string[] = [
  'edu77santoyo@gmail.com'
]

interface CloseOthersRequest {
  currentSessionId: string
}

interface CloseOthersResponse {
  success: boolean
  closedCount?: number
  message?: string
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<CloseOthersResponse>> {
  try {
    // Obtener el token de autenticación
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
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
        success: false,
        error: 'Usuario no autenticado'
      }, { status: 401 })
    }

    // Verificar si el usuario está en la lista de control
    if (!user.email || !CONTROLLED_EMAILS.includes(user.email)) {
      return NextResponse.json({
        success: false,
        error: 'Usuario no autorizado para esta acción'
      }, { status: 403 })
    }

    // Obtener currentSessionId del body
    const body: CloseOthersRequest = await request.json()
    const { currentSessionId } = body

    if (!currentSessionId) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere currentSessionId'
      }, { status: 400 })
    }

    // Usar service role para modificar sesiones (bypass RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Cerrar todas las sesiones activas excepto la actual
    // Actualizar session_end a NOW() para marcarlas como cerradas
    const { data: closedSessions, error: closeError } = await supabaseAdmin
      .from('user_sessions')
      .update({
        session_end: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .is('session_end', null)
      .neq('id', currentSessionId)
      .select('id')

    if (closeError) {
      console.error('Error cerrando sesiones:', closeError)
      return NextResponse.json({
        success: false,
        error: 'Error cerrando sesiones'
      }, { status: 500 })
    }

    const closedCount = closedSessions?.length || 0

    console.log(`[SessionControl] Usuario ${user.email} cerró ${closedCount} sesiones remotas`)

    return NextResponse.json({
      success: true,
      closedCount,
      message: closedCount > 0
        ? `Se cerraron ${closedCount} sesión(es) en otros dispositivos`
        : 'No había otras sesiones activas'
    })

  } catch (error) {
    console.error('Error en close-others:', error)
    return NextResponse.json({
      success: false,
      error: 'Error interno'
    }, { status: 500 })
  }
}
