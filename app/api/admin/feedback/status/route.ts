// app/api/admin/feedback/status/route.ts
// API para actualizar estado de feedbacks
// Usa Drizzle + Zod para tipado robusto

import { NextRequest, NextResponse } from 'next/server'
import {
  updateFeedbackStatus,
  getPendingCounts,
  safeParseUpdateFeedbackStatus
} from '@/lib/api/admin-feedback'

// ============================================
// POST - Actualizar estado de feedback
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validation = safeParseUpdateFeedbackStatus(body)

    if (!validation.success) {
      console.error('❌ [API/admin/feedback/status] Validation error:', validation.error.flatten())
      return NextResponse.json(
        {
          success: false,
          error: 'Datos inválidos',
          details: validation.error.flatten()
        },
        { status: 400 }
      )
    }

    const result = await updateFeedbackStatus(validation.data)

    if (!result.success) {
      const status = result.error === 'Feedback no encontrado' ? 404 : 500
      return NextResponse.json(
        { success: false, error: result.error },
        { status }
      )
    }

    console.log('✅ [API/admin/feedback/status] Status updated:', {
      feedbackId: validation.data.feedbackId,
      newStatus: validation.data.status
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/admin/feedback/status] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}

// ============================================
// GET - Obtener contadores pendientes (para badges)
// ============================================

export async function GET() {
  try {
    const result = await getPendingCounts()

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ [API/admin/feedback/status] Error getting counts:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor'
      },
      { status: 500 }
    )
  }
}
