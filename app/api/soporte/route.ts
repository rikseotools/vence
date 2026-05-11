// app/api/soporte/route.ts
// GET — carga todos los datos del usuario para la página de soporte
import { NextRequest, NextResponse } from 'next/server'
import {
  getUserFeedbacksWithConversations,
  getUserDisputes,
} from '@/lib/api/soporte'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'

async function _GET(request: NextRequest) {
  try {
    // Auth (wrapper Fase 0.7 — soporta off/shadow/on)
    const auth = await verifyAuth(request, '/api/soporte')
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: auth.reason === 'no_bearer_token' ? 'No autorizado' : 'Token inválido' },
        { status: 401 }
      )
    }
    const user = { id: auth.userId, email: auth.email }

    // Cargar feedbacks + conversaciones y disputes en paralelo
    const [feedbacks, disputes] = await Promise.all([
      getUserFeedbacksWithConversations(user.id),
      getUserDisputes(user.id),
    ])

    return NextResponse.json({
      success: true,
      feedbacks,
      disputes,
    })

  } catch (error) {
    console.error('❌ [API/soporte] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/soporte', _GET)
