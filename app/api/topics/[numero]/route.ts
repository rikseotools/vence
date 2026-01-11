// app/api/topics/[numero]/route.ts - API endpoint para datos de tema
import { NextRequest, NextResponse } from 'next/server'
import { getTopicFullData } from '@/lib/api/topic-data'
import {
  safeParseGetTopicDataRequest,
  isValidTopicNumber,
  type OposicionKey
} from '@/lib/api/topic-data'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  try {
    const { numero } = await params
    const searchParams = request.nextUrl.searchParams
    const oposicion = searchParams.get('oposicion') as OposicionKey
    const userId = searchParams.get('userId')

    // Validar número de tema
    const topicNumber = parseInt(numero, 10)
    if (isNaN(topicNumber)) {
      return NextResponse.json(
        { success: false, error: 'Número de tema inválido' },
        { status: 400 }
      )
    }

    // Validar oposición
    if (!oposicion || !['auxiliar-administrativo-estado', 'administrativo-estado'].includes(oposicion)) {
      return NextResponse.json(
        { success: false, error: 'Oposición no válida. Debe ser auxiliar-administrativo-estado o administrativo-estado' },
        { status: 400 }
      )
    }

    // Validar que el tema existe para la oposición
    if (!isValidTopicNumber(topicNumber, oposicion)) {
      return NextResponse.json(
        { success: false, error: `Tema ${topicNumber} no válido para ${oposicion}` },
        { status: 400 }
      )
    }

    // Validar request completo con Zod
    const parseResult = safeParseGetTopicDataRequest({
      topicNumber,
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

    // Obtener datos del tema
    const result = await getTopicFullData(
      parseResult.data.topicNumber,
      parseResult.data.oposicion,
      parseResult.data.userId
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en API /api/topics/[numero]:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
