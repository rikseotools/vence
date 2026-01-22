// app/api/tema-resolver/route.ts - API para resolver tema por artículo
import { NextRequest, NextResponse } from 'next/server'
import {
  resolveTemaByArticle,
  resolveTemasBatch,
  safeParseResolveTemaRequest,
  safeParseResolveTemasBatchRequest,
} from '@/lib/api/tema-resolver'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/tema-resolver
 * Resuelve el tema para una pregunta/artículo individual
 *
 * Query params:
 * - questionId: UUID de la pregunta (opcional)
 * - articleId: UUID del artículo (opcional)
 * - articleNumber: Número del artículo (opcional)
 * - lawId: UUID de la ley (opcional)
 * - lawShortName: Nombre corto de la ley (opcional)
 * - oposicionId: ID de la oposición (default: auxiliar_administrativo_estado)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const params = {
      questionId: searchParams.get('questionId'),
      articleId: searchParams.get('articleId'),
      articleNumber: searchParams.get('articleNumber'),
      lawId: searchParams.get('lawId'),
      lawShortName: searchParams.get('lawShortName'),
      oposicionId: searchParams.get('oposicionId') || 'auxiliar_administrativo_estado',
    }

    // Validar request
    const parseResult = safeParseResolveTemaRequest(params)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          temaNumber: null,
          error: 'Parámetros inválidos',
          details: parseResult.error.issues,
        },
        { status: 400 }
      )
    }

    // Resolver tema
    const result = await resolveTemaByArticle(parseResult.data)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('❌ [API/tema-resolver] Error:', error)
    return NextResponse.json(
      {
        success: false,
        temaNumber: null,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tema-resolver
 * Resuelve temas para múltiples preguntas en batch
 *
 * Body:
 * {
 *   questions: [
 *     { questionId?, articleId?, articleNumber?, lawId? },
 *     ...
 *   ],
 *   oposicionId: string (default: auxiliar_administrativo_estado)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validar request
    const parseResult = safeParseResolveTemasBatchRequest(body)
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Parámetros inválidos',
          details: parseResult.error.issues,
        },
        { status: 400 }
      )
    }

    // Resolver temas en batch
    const result = await resolveTemasBatch(parseResult.data)

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('❌ [API/tema-resolver/batch] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}
