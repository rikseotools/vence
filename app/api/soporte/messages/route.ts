// app/api/soporte/messages/route.ts
// GET — carga mensajes de una conversación específica
import { NextRequest, NextResponse } from 'next/server'
import { getConversationMessages } from '@/lib/api/soporte'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

async function _GET(request: NextRequest) {
  try {
    // Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/soporte/messages')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

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

export const GET = withErrorLogging('/api/soporte/messages', _GET)
