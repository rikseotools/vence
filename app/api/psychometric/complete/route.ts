// app/api/psychometric/complete/route.ts
// POST - Marcar una sesión psicotécnica como completada (server-side, bypasses RLS)

import { NextRequest, NextResponse } from 'next/server'
import { completePsychometricSession, completePsychometricSessionRequestSchema } from '@/lib/api/psychometric-session'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = completePsychometricSessionRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 }
      )
    }

    const result = await completePsychometricSession(parsed.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /api/psychometric/complete:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/psychometric/complete', _POST)
