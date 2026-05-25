// app/api/v2/test-config/estimate/route.ts
// GET /api/v2/test-config/estimate?topicNumber=1&positionType=auxiliar_administrativo&...
import { NextRequest, NextResponse } from 'next/server'
import { safeParseEstimateQuestions, estimateAvailableQuestionsCached } from '@/lib/api/test-config'
import { shouldRouteToBackend, backendUrlFor } from '@/lib/api/backend-router'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET(request: NextRequest) {
  try {
    // ─── Bloque 3 canary: proxy condicional al backend NestJS/Fargate ──
    // estimate tiene params complejos JSON — los reenviamos via search string
    // tal cual; backend hace su propio parse equivalente.
    if (shouldRouteToBackend('test-config')) {
      try {
        const { search } = new URL(request.url)
        const backendUrl = backendUrlFor(`api/v2/test-config/estimate${search}`)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000) // 8s — estimate puede ser lento
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
          `⚠️ [test-config/estimate proxy] backend canary falló (${(backendError as Error).message ?? 'unknown'}), fallback Vercel local`,
        )
      }
    }

    const { searchParams } = new URL(request.url)

    // Parsear JSON de parámetros complejos
    let selectedArticlesByLaw = {}
    let selectedSectionFilters: unknown[] = []

    try {
      const sabParam = searchParams.get('selectedArticlesByLaw')
      if (sabParam) selectedArticlesByLaw = JSON.parse(sabParam)
    } catch { /* ignorar JSON inválido */ }

    try {
      const ssfParam = searchParams.get('selectedSectionFilters')
      if (ssfParam) selectedSectionFilters = JSON.parse(ssfParam)
    } catch { /* ignorar JSON inválido */ }

    const rawData = {
      topicNumber: searchParams.get('topicNumber') ? Number(searchParams.get('topicNumber')) : null,
      positionType: searchParams.get('positionType') || undefined,
      selectedLaws: (() => {
        const all = searchParams.getAll('selectedLaws')
        if (all.length > 1) return all // Multiple repeated params: ?selectedLaws=CE&selectedLaws=LO
        if (all.length === 1) return all[0].split(',') // Single comma-separated: ?selectedLaws=CE,LO
        return []
      })(),
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions: searchParams.get('onlyOfficialQuestions') === 'true',
      difficultyMode: searchParams.get('difficultyMode') || 'random',
      focusEssentialArticles: searchParams.get('focusEssentialArticles') === 'true',
    }

    const parseResult = safeParseEstimateQuestions(rawData)

    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.issues,
      }, { status: 400 })
    }

    const result = await estimateAvailableQuestionsCached(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/v2/test-config/estimate] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/test-config/estimate', _GET)
