// app/api/sessions/close-others/route.ts
// API para cerrar todas las sesiones excepto la actual
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
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

async function _POST(request: NextRequest): Promise<NextResponse<CloseOthersResponse>> {
  try {
    // Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/sessions/close-others')
    if (!auth.success) {
      return NextResponse.json({
        success: false,
        error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Usuario no autenticado'
      }, { status: 401 })
    }
    const user = { id: auth.userId, email: auth.email }

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

export const POST = withErrorLogging('/api/sessions/close-others', _POST)
