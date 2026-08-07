// app/api/psychometric/discard/route.ts
// POST - Descartar una sesión psicotécnica incompleta

import { NextRequest, NextResponse } from 'next/server'
import { discardPsychometricSession, getSessionOwnerId } from '@/lib/api/psychometric-session'
import { discardPsychometricSessionRequestSchema } from '@/lib/api/psychometric-session'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/psychometric/discard'

export const dynamic = 'force-dynamic'

// [T-565]: la propiedad se comparaba contra el `userId` del BODY — con el UUID de la
// sesión y el de la víctima se le podía descartar el test a otra persona.
async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = discardPsychometricSessionRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos inválidos' },
        { status: 400 }
      )
    }

    const { sessionId } = parsed.data
    const sessionOwnerId = await getSessionOwnerId(sessionId)
    const identidad = await requireDuenoDelRecurso(request, ENDPOINT, sessionOwnerId)
    if (!identidad.ok) return identidad.response

    const result = await discardPsychometricSession(sessionId, sessionOwnerId ?? parsed.data.userId)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /api/psychometric/discard:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/psychometric/discard', _POST)
