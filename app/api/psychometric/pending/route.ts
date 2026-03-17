// app/api/psychometric/pending/route.ts
// GET - Sesiones psicotécnicas incompletas con progreso

import { NextRequest, NextResponse } from 'next/server'
import { getPendingPsychometricSessions } from '@/lib/api/psychometric-session'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limitParam = searchParams.get('limit')

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId es requerido' }, { status: 400 })
    }

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
