// app/api/psychometric/complete/route.ts
// POST - Marcar una sesión psicotécnica como completada (server-side, bypasses RLS)

import { NextRequest, NextResponse } from 'next/server'
import {
  completePsychometricSession,
  completePsychometricSessionRequestSchema,
  getSessionOwnerId,
} from '@/lib/api/psychometric-session'
import { requireDuenoDelRecurso } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/psychometric/complete'

export const dynamic = 'force-dynamic'

// [T-565]: la propiedad se comparaba contra un `userId` puesto por el CLIENTE — con
// el UUID de la sesión y el de la víctima (su propio id, no secreto) se le podía
// completar el test a otra persona.
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

    const sessionOwnerId = await getSessionOwnerId(parsed.data.sessionId)
    const identidad = await requireDuenoDelRecurso(request, ENDPOINT, sessionOwnerId)
    if (!identidad.ok) return identidad.response

    const result = await completePsychometricSession({
      ...parsed.data,
      userId: sessionOwnerId ?? parsed.data.userId,
    })

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
