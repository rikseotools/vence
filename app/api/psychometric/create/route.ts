// app/api/psychometric/create/route.ts
// POST - Crear una nueva sesión psicotécnica (server-side, bypasses RLS)

import { NextRequest, NextResponse } from 'next/server'
import { createPsychometricSession, createPsychometricSessionRequestSchema } from '@/lib/api/psychometric-session'
import { requireUsuarioPropio } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/psychometric/create'

export const dynamic = 'force-dynamic'

// [T-565]: el `userId` bajo el que se creaba la sesión lo ponía el CLIENTE sin
// comprobar nada — se podía sembrar sesiones (y su ruido en stats) en la cuenta de
// otra persona con solo su UUID.
async function _POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = createPsychometricSessionRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Datos invalidos' },
        { status: 400 }
      )
    }

    const identidad = await requireUsuarioPropio(request, ENDPOINT, parsed.data.userId)
    if (!identidad.ok) return identidad.response

    const result = await createPsychometricSession({ ...parsed.data, userId: identidad.userId })

    if (!result.success) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /api/psychometric/create:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/psychometric/create', _POST)
