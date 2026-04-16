// app/api/stripe/cancel/feedback/route.ts
// Envía feedback post-cancelación (opcional). El flujo 1-clic crea el
// registro cancellation_feedback con reason='pending_feedback'; este
// endpoint lo actualiza si el usuario decide compartir el motivo.
import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import {
  safeParseSubmitCancellationFeedback,
  submitCancellationFeedback,
} from '@/lib/api/subscription'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parseResult = safeParseSubmitCancellationFeedback(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parseResult.error.flatten() },
        { status: 400 },
      )
    }

    const result = await submitCancellationFeedback(parseResult.data)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'No se pudo guardar el feedback' },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 },
    )
  }
}

export const POST = withErrorLogging('/api/stripe/cancel/feedback', _POST)
