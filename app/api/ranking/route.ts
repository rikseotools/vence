// app/api/ranking/route.ts - API endpoint para ranking
import { NextRequest, NextResponse } from 'next/server'
import {
  safeParseGetRankingRequest,
  getRanking,
} from '@/lib/api/ranking'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// GET: Obtener ranking
// ============================================

export async function GET(request: NextRequest) {
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

    // Validar request con Zod
    const parseResult = safeParseGetRankingRequest({
      timeFilter,
      userId,
      minQuestions,
      limit,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Parametros invalidos', details: parseResult.error.issues },
        { status: 400 }
      )
    }

    const result = await getRanking(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    })
  } catch (error) {
    console.error('❌ [API/ranking] Error GET:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
