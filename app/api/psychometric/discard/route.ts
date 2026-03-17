// app/api/psychometric/discard/route.ts
// POST - Descartar una sesión psicotécnica incompleta

import { NextRequest, NextResponse } from 'next/server'
import { discardPsychometricSession } from '@/lib/api/psychometric-session'
import { discardPsychometricSessionRequestSchema } from '@/lib/api/psychometric-session'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

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

    const { sessionId, userId } = parsed.data
    const result = await discardPsychometricSession(sessionId, userId)

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
