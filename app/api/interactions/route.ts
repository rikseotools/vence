// app/api/interactions/route.ts - API endpoint para tracking de interacciones de usuario
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseInteractionRequest,
  safeParseInteractionBatchRequest,
  trackInteraction,
  trackBatchInteractions
} from '@/lib/api/interactions'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
// maxDuration bajado de 60s → 10s tras incidente cascade 2026-05-07 12:34 UTC
// (50+ 504s en /api/interactions durante blip de 3min). El INSERT user_interactions
// es write path simple (<500ms en happy path); 10s da margen suficiente para
// happy path lento sin permitir que un blip de pool agote la concurrency Vercel.
export const maxDuration = 10

// Quick-fail timeout (Phase 3 hardening). 5s es el techo razonable para un
// INSERT en user_interactions. Si tarda más, es señal de blip — abortamos en
// vez de bloquear el lambda los 10s completos.
const INTERACTIONS_TIMEOUT_MS = 5000

// ============================================
// POST: Registrar interacción(es)
// ============================================

async function _POST(request: NextRequest) {
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

      const result = await withDbTimeout(
        () => trackBatchInteractions(parseResult.data),
        INTERACTIONS_TIMEOUT_MS,
      )

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

      const result = await withDbTimeout(
        () => trackInteraction(parseResult.data),
        INTERACTIONS_TIMEOUT_MS,
      )

      return NextResponse.json(result)
    }

  } catch (error) {
    if (isDbTimeoutError(error)) {
      // Cascade prevention: en blip de pool devolvemos 200 con success:false
      // en vez de esperar 60s que satura concurrency Vercel. El cliente
      // (useInteractionTracker.ts) NO borra de la queue si success !== true,
      // así que los eventos quedan persistidos en localStorage para reintentar
      // cuando el pool se recupere. Sentry sigue capturando el timeout vía
      // withDbTimeout con tag quick_fail=db_timeout.
      console.warn('⏱️ [API/interactions] Timeout (quick-fail) — degradado a 200/queued=false:', error.timeoutMs, 'ms')
      return NextResponse.json({ success: false, queued: false, reason: 'db_unavailable' }, { status: 200 })
    }
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

export const POST = withErrorLogging('/api/interactions', _POST)
