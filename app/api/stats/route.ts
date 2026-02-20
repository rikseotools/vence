// app/api/stats/route.ts - API de estadísticas optimizada
import { NextRequest, NextResponse } from 'next/server'
import { getUserStats, safeParseGetUserStatsRequest } from '@/lib/api/stats'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 300

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Validar request
    const parseResult = safeParseGetUserStatsRequest({ userId })
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'userId inválido o faltante' },
        { status: 400 }
      )
    }

    // Obtener estadísticas
    const stats = await getUserStats(parseResult.data.userId)

    if (!stats.success) {
      return NextResponse.json(stats, { status: 500 })
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error en API de estadísticas:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
