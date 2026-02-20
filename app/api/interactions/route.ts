// app/api/interactions/route.ts - API endpoint para tracking de interacciones de usuario
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseInteractionRequest,
  safeParseInteractionBatchRequest,
  trackInteraction,
  trackBatchInteractions
} from '@/lib/api/interactions'

export const maxDuration = 60

// ============================================
// POST: Registrar interacción(es)
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Detectar si es batch o single
    if (body.events && Array.isArray(body.events)) {
      // Batch de eventos
      const parseResult = safeParseInteractionBatchRequest(body)

      if (!parseResult.success) {
        console.warn('⚠️ [API/interactions] Validación batch fallida:', parseResult.error.issues)
        return NextResponse.json(
          { success: false, error: 'Datos de batch inválidos' },
          { status: 400 }
        )
      }

      const result = await trackBatchInteractions(parseResult.data)

      return NextResponse.json(result)

    } else {
      // Evento individual
      const parseResult = safeParseInteractionRequest(body)

      if (!parseResult.success) {
        console.warn('⚠️ [API/interactions] Validación fallida:', parseResult.error.issues)
        return NextResponse.json(
          { success: false, error: 'Datos de evento inválidos' },
          { status: 400 }
        )
      }

      const result = await trackInteraction(parseResult.data)

      return NextResponse.json(result)
    }

  } catch (error) {
    console.error('❌ [API/interactions] Error interno:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ============================================
// OPTIONS: CORS preflight
// ============================================

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
