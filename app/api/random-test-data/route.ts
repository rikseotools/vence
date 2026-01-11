// app/api/random-test-data/route.ts - API endpoint para datos de test aleatorio
import { NextRequest, NextResponse } from 'next/server'
import { getRandomTestData } from '@/lib/api/random-test-data'
import {
  safeParseGetRandomTestDataRequest,
  type OposicionKey
} from '@/lib/api/random-test-data'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const oposicion = searchParams.get('oposicion') as OposicionKey
    const userId = searchParams.get('userId')

    // Validar oposición
    if (!oposicion || !['auxiliar-administrativo-estado', 'administrativo-estado'].includes(oposicion)) {
      return NextResponse.json(
        { success: false, error: 'Oposición no válida. Debe ser auxiliar-administrativo-estado o administrativo-estado' },
        { status: 400 }
      )
    }

    // Validar request completo con Zod
    const parseResult = safeParseGetRandomTestDataRequest({
      oposicion,
      userId: userId || null,
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
    const result = await getRandomTestData(
      parseResult.data.oposicion,
      parseResult.data.userId
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /api/random-test-data:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
