// app/api/ranking/streaks/route.ts - API endpoint para ranking de rachas
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetStreakRankingRequest,
  getStreakRanking,
} from '@/lib/api/ranking'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener ranking de rachas
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeFilter = searchParams.get('timeFilter')
    const category = searchParams.get('category') || undefined
    const userId = searchParams.get('userId') || undefined
    const limit = searchParams.get('limit')
      ? Number(searchParams.get('limit'))
      : undefined
    const offset = searchParams.get('offset')
      ? Number(searchParams.get('offset'))
      : undefined

    const parseResult = safeParseGetStreakRankingRequest({
      timeFilter,
      category,
      userId,
      limit,
      offset,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Parametros invalidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const result = await getStreakRanking(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    })
  } catch (error) {
    console.error('❌ [API/ranking/streaks] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
