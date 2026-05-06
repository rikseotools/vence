// app/api/ranking/route.ts - API endpoint para ranking
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetRankingRequest,
  getRanking,
} from '@/lib/api/ranking'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Quick-fail timeout 12s — getRanking hace aggregation sobre user_profiles
// + test_questions. Apareció en el cascade del 5 may.
const RANKING_TIMEOUT_MS = 12000

// ============================================
// GET: Obtener ranking
// ============================================

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeFilter = searchParams.get('timeFilter')
    const userId = searchParams.get('userId') || undefined
    const minQuestions = searchParams.get('minQuestions')
      ? Number(searchParams.get('minQuestions'))
      : undefined
    const limit = searchParams.get('limit')
      ? Number(searchParams.get('limit'))
      : undefined
    const offset = searchParams.get('offset')
      ? Number(searchParams.get('offset'))
      : undefined

    // Validar request con Zod
    const parseResult = safeParseGetRankingRequest({
      timeFilter,
      userId,
      minQuestions,
      limit,
      offset,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Parametros invalidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const result = await withDbTimeout(
      () => getRanking(parseResult.data),
      RANKING_TIMEOUT_MS,
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    })
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/ranking] Timeout (quick-fail):', error.timeoutMs, 'ms')
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } },
      )
    }
    console.error('❌ [API/ranking] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/ranking', _GET)
