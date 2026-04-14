// app/api/v2/feedback/respond/route.ts
// Endpoint admin para responder/cerrar feedbacks in-process.
// Sustituye el flujo manual de 3 pasos (INSERT msg + INSERT notif_log + fetch
// /api/send-support-email) por una sola llamada atómica.
//
// Patrón coherente con /api/v2/dispute/resolve (impugnaciones, 14/04/2026).

import { NextRequest, NextResponse } from 'next/server'
import {
  respondFeedbackRequestSchema,
  respondFeedback,
} from '@/lib/api/v2/feedback'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Body JSON invalido' },
      { status: 400 }
    )
  }

  const parsed = respondFeedbackRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Datos de entrada invalidos',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const result = await respondFeedback(parsed.data)

  if (!result.success) {
    const status = result.error.includes('no encontrado') ? 404 :
                   result.error.includes('conversacion') ? 409 : 500
    return NextResponse.json(result, { status })
  }

  return NextResponse.json(result)
}

export const POST = withErrorLogging('/api/v2/feedback/respond', _POST)
