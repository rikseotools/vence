// app/api/psychometric/resume/route.ts
// GET - Cargar datos de sesión psicotécnica para reanudarla

import { NextRequest, NextResponse } from 'next/server'
import { getResumedPsychometricSessionData, getSessionOwnerId } from '@/lib/api/psychometric-session'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/psychometric/resume'

export const dynamic = 'force-dynamic'

// [T-565]: la comprobación era opcional (solo corría si la query traía `userId`) — con
// solo el UUID de la sesión se leían sus preguntas y qué había respondido ya.
async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId es requerido' }, { status: 400 })
    }

    const sessionOwnerId = await getSessionOwnerId(sessionId)
    const identidad = await requireDuenoDelRecurso(request, ENDPOINT, sessionOwnerId)
    if (!identidad.ok) return identidad.response

    const result = await getResumedPsychometricSessionData(sessionId, sessionOwnerId ?? undefined)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /api/psychometric/resume:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/psychometric/resume', _GET)
