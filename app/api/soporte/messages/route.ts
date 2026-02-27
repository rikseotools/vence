// app/api/soporte/messages/route.ts
// GET — carga mensajes de una conversación específica
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getConversationMessages } from '@/lib/api/soporte'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Auth
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await getSupabase().auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Leer conversationId del query param
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: 'conversationId es requerido' },
        { status: 400 }
      )
    }

    const result = await getConversationMessages(conversationId, user.id)

    if (!result.success) {
      const status = result.error === 'Conversación no encontrada' ? 404
        : result.error === 'No tienes permiso para esta conversación' ? 403
        : 500
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/soporte/messages] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
