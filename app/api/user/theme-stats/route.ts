// app/api/user/theme-stats/route.ts - API de estadísticas por tema
import { NextRequest, NextResponse } from 'next/server'
import { getUserThemeStats, safeParseGetThemeStatsRequest } from '@/lib/api/theme-stats'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Validar request con Zod
    const parseResult = safeParseGetThemeStatsRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId inválido o faltante' },
        { status: 400 }
      )
    }

    // Obtener estadísticas por tema
    const stats = await getUserThemeStats(parseResult.data.userId)

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
    console.error('Error en API de estadísticas por tema:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
