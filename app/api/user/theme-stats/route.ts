// app/api/user/theme-stats/route.ts - API de estadísticas por tema
// V2: Soporta oposicionId para derivar tema dinámicamente desde article_id
import { NextRequest, NextResponse } from 'next/server'
import {
  getUserThemeStats,
  safeParseGetThemeStatsRequest,
  type OposicionSlug,
  VALID_OPOSICIONES
} from '@/lib/api/theme-stats'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 60

export async function GET(request: NextRequest) {
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
    const stats = await getUserThemeStats(
      parseResult.data.userId,
      parseResult.data.oposicionId
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
    console.error('Error en API de estadísticas por tema:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
