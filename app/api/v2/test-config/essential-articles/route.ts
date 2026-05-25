// app/api/v2/test-config/essential-articles/route.ts
// GET /api/v2/test-config/essential-articles?topicNumber=1&positionType=auxiliar_administrativo
import { NextRequest, NextResponse } from 'next/server'
import { safeParseGetEssentialArticles, getEssentialArticlesCached } from '@/lib/api/test-config'
import { shouldRouteToBackend, backendUrlFor } from '@/lib/api/backend-router'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET(request: NextRequest) {
  try {
    // ─── Bloque 3 canary: proxy condicional al backend NestJS/Fargate ──
    if (shouldRouteToBackend('test-config')) {
      try {
        const { search } = new URL(request.url)
        const backendUrl = backendUrlFor(`api/v2/test-config/essential-articles${search}`)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        try {
          const backendRes = await fetch(backendUrl, {
            signal: controller.signal,
            headers: { 'x-forwarded-by': 'vercel-proxy' },
          })
          clearTimeout(timer)
          const body = await backendRes.text()
          return new NextResponse(body, {
            status: backendRes.status,
            headers: {
              'Content-Type': backendRes.headers.get('content-type') ?? 'application/json',
              'x-served-by': backendRes.headers.get('x-served-by') ?? 'vence-backend-proxy',
            },
          })
        } finally {
          clearTimeout(timer)
        }
      } catch (backendError) {
        console.warn(
          `⚠️ [test-config/essential-articles proxy] backend canary falló (${(backendError as Error).message ?? 'unknown'}), fallback Vercel local`,
        )
      }
    }

    const { searchParams } = new URL(request.url)

    const rawData = {
      topicNumber: searchParams.get('topicNumber') ? Number(searchParams.get('topicNumber')) : undefined,
      positionType: searchParams.get('positionType') || undefined,
    }

    const parseResult = safeParseGetEssentialArticles(rawData)

    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.issues,
      }, { status: 400 })
    }

    const result = await getEssentialArticlesCached(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/v2/test-config/essential-articles] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/test-config/essential-articles', _GET)
