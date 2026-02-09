// app/api/cron/close-inactive-feedback/route.ts
// Cron: Cerrar feedback inactivos automáticamente
//
// Cierra conversaciones que llevan más de X días sin actividad:
// - waiting_user: Usuario no ha respondido en 7 días
// - open: Conversación sin actividad en 14 días
// - waiting_admin: Muy antiguas (>30 días)
//
// Se ejecuta diariamente via GitHub Actions

import { NextResponse, NextRequest } from 'next/server'
import {
  closeInactiveFeedback,
  DAYS_WAITING_USER,
  DAYS_OPEN_INACTIVE,
  DAYS_WAITING_ADMIN,
  type CloseInactiveFeedbackResponse,
} from '@/lib/api/close-inactive-feedback'

export async function GET(
  request: NextRequest
): Promise<NextResponse<CloseInactiveFeedbackResponse>> {
  try {
    // Verificar authorization header
    const authHeader = request.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

    if (authHeader !== expectedAuth) {
      console.error('❌ Unauthorized request to close-inactive-feedback cron')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Ejecutar cierre de feedback inactivos
    const closed = await closeInactiveFeedback()

    return NextResponse.json({
      success: true,
      closed,
      config: {
        days_waiting_user: DAYS_WAITING_USER,
        days_open_inactive: DAYS_OPEN_INACTIVE,
        days_waiting_admin: DAYS_WAITING_ADMIN,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Error en close-inactive-feedback:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
