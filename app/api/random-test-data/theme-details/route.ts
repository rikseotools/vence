// app/api/random-test-data/theme-details/route.ts - API para estadísticas detalladas de un tema
import { NextRequest, NextResponse } from 'next/server'
import { getDetailedThemeStats } from '@/lib/api/random-test-data'
import {
  safeParseGetDetailedThemeStatsRequest,
  type OposicionKey
} from '@/lib/api/random-test-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const oposicion = searchParams.get('oposicion') as OposicionKey
    const themeIdStr = searchParams.get('themeId')
    const userId = searchParams.get('userId')

    // Validar parámetros básicos
    if (!oposicion || !['auxiliar-administrativo-estado', 'administrativo-estado'].includes(oposicion)) {
      return NextResponse.json(
        { success: false, error: 'Oposición no válida' },
        { status: 400 }
      )
    }

    if (!themeIdStr) {
      return NextResponse.json(
        { success: false, error: 'themeId es requerido' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId es requerido para estadísticas detalladas' },
        { status: 400 }
      )
    }

    const themeId = parseInt(themeIdStr, 10)
    if (isNaN(themeId) || themeId <= 0) {
      return NextResponse.json(
        { success: false, error: 'themeId debe ser un número positivo' },
        { status: 400 }
      )
    }

    // Validar request completo con Zod
    const parseResult = safeParseGetDetailedThemeStatsRequest({
      oposicion,
      themeId,
      userId,
    })

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: parseResult.error.issues.map(i => i.message),
        },
        { status: 400 }
      )
    }

    // Obtener datos
    const result = await getDetailedThemeStats(
      parseResult.data.oposicion,
      parseResult.data.themeId,
      parseResult.data.userId
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /api/random-test-data/theme-details:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
