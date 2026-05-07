// app/api/user/theme-stats/route.ts - API de estadísticas por tema
// V2: Soporta oposicionId para derivar tema dinámicamente desde article_id
import { NextRequest, NextResponse } from 'next/server'
import {
  getUserThemeStats,
  safeParseGetThemeStatsRequest,
  type OposicionSlug,
  VALID_OPOSICIONES
} from '@/lib/api/theme-stats'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
export const dynamic = 'force-dynamic'
export const revalidate = 0
// maxDuration bajado de 60s → 20s tras incidente cascade 2026-05-07. Endpoint
// dashboard user-facing que comparte vulnerabilidad con weak-articles. La query
// está respaldada por covering index idx_tq_user_tema_covering (commit 068c5e5b)
// que la hace <500ms warm; 20s da margen sin permitir saturación de concurrency.
export const maxDuration = 20

const THEME_STATS_TIMEOUT_MS = 15000

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const oposicionId = searchParams.get('oposicionId') as OposicionSlug | null

    // Validar request con Zod
    const parseResult = safeParseGetThemeStatsRequest({
      userId,
      oposicionId: oposicionId || undefined
    })

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: parseResult.error.issues.map(i => i.message)
        },
        { status: 400 }
      )
    }

    // Obtener estadísticas por tema
    // Si oposicionId está presente, usa la nueva lógica V2 que deriva tema desde article_id
    // Si no, usa la lógica legacy basada en tema_number guardado
    const stats = await withDbTimeout(
      () => getUserThemeStats(parseResult.data.userId, parseResult.data.oposicionId),
      THEME_STATS_TIMEOUT_MS,
    )

    if (!stats.success) {
      return NextResponse.json(stats, { status: 500 })
    }

    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/theme-stats] Timeout (quick-fail):', error.timeoutMs, 'ms')
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } },
      )
    }
    console.error('Error en API de estadísticas por tema:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/user/theme-stats', _GET)
