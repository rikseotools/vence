// app/api/psychometric/pending/route.ts
// GET - Sesiones psicotécnicas incompletas con progreso

import { NextRequest, NextResponse } from 'next/server'
import { getPendingPsychometricSessions } from '@/lib/api/psychometric-session'
import { requireUsuarioPropio } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const ENDPOINT = '/api/psychometric/pending'

export const dynamic = 'force-dynamic'

// [T-565]: se leía con solo el UUID de cualquiera en la query, sin sesión.
async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawUserId = searchParams.get('userId')
    const limitParam = searchParams.get('limit')

    const identidad = await requireUsuarioPropio(request, ENDPOINT, rawUserId)
    if (!identidad.ok) return identidad.response
    const userId = identidad.userId

    const limit = limitParam ? parseInt(limitParam, 10) : 10

    const result = await getPendingPsychometricSessions(userId, limit)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /api/psychometric/pending:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/psychometric/pending', _GET)
