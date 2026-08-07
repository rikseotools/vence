// app/api/random-test/user-stats/route.ts - API para estadísticas de usuario por tema
import { NextRequest, NextResponse } from 'next/server'
import { getUserThemeStats } from '@/lib/api/random-test/queries'
import { GetUserStatsRequestSchema } from '@/lib/api/random-test/schemas'
import { requireUsuarioPropio } from '@/lib/api/shared/auth'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'

const ENDPOINT = '/api/random-test/user-stats'

// Hasta [T-565] esto tomaba `userId` del body y lo usaba tal cual: gemelo del agujero de
// /api/v2/user-stats, con el mismo dato (progreso por tema) y la misma ausencia de caso de
// uso legítimo cruzado (RandomTestClient solo pide las stats de quien tiene la sesión).
async function _POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()

    // Validar request con Zod
    const parseResult = GetUserStatsRequestSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: parseResult.error.issues.map(e => e.message).join(', '),
      }, { status: 400 })
    }

    const { oposicion, userId } = parseResult.data

    const identidad = await requireUsuarioPropio(request, ENDPOINT, userId)
    if (!identidad.ok) return identidad.response

    // Obtener estadísticas
    const stats = await getUserThemeStats(oposicion, identidad.userId)

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('❌ [API/random-test/user-stats] Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor',
    }, { status: 500 })
  }
}

export const POST = withErrorLogging('/api/random-test/user-stats', _POST)
