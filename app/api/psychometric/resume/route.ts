// app/api/psychometric/resume/route.ts
// GET - Cargar datos de sesión psicotécnica para reanudarla

import { NextRequest, NextResponse } from 'next/server'
import { getResumedPsychometricSessionData } from '@/lib/api/psychometric-session'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const userId = searchParams.get('userId') || undefined

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId es requerido' }, { status: 400 })
    }

    const result = await getResumedPsychometricSessionData(sessionId, userId)

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
