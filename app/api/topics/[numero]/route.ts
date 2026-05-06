// app/api/topics/[numero]/route.ts - API endpoint para datos de tema
import { NextRequest, NextResponse } from 'next/server'
import { getTopicFullData } from '@/lib/api/topic-data'
import {
  safeParseGetTopicDataRequest,
  isValidTopicNumber,
  type OposicionKey
} from '@/lib/api/topic-data'
import { ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

export const dynamic = 'force-dynamic'

// Quick-fail timeout 12s — getTopicFullData hace varias queries
// (topic_scope + counts + per-user analytics si hay userId). 12s da
// margen para la versión per-user; en cascada del 5 may aparecía
// /api/topics/12 y /api/topics/105 entre los 504s.
const TOPIC_TIMEOUT_MS = 12000

async function _GET(
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
    if (!oposicion || !ALL_OPOSICION_SLUGS.includes(oposicion)) {
      return NextResponse.json(
        { success: false, error: 'Oposición no válida' },
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
    const result = await withDbTimeout(
      () => getTopicFullData(
        parseResult.data.topicNumber,
        parseResult.data.oposicion as OposicionKey,
        parseResult.data.userId
      ),
      TOPIC_TIMEOUT_MS,
    )

    if (!result.success) {
      return NextResponse.json(result, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/topics] Timeout (quick-fail):', error.timeoutMs, 'ms')
      return NextResponse.json(
        { success: false, error: 'Servicio temporalmente saturado. Reintenta.', retryable: true },
        { status: 503, headers: { 'Retry-After': '5' } },
      )
    }
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

export const GET = withErrorLogging('/api/topics/[numero]', _GET)
