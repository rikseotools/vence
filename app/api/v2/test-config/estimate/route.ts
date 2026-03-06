// app/api/v2/test-config/estimate/route.ts
// GET /api/v2/test-config/estimate?topicNumber=1&positionType=auxiliar_administrativo&...
import { NextRequest, NextResponse } from 'next/server'
import { safeParseEstimateQuestions, estimateAvailableQuestions } from '@/lib/api/test-config'

export async function GET(request: NextRequest) {
  try {
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
      selectedLaws: searchParams.getAll('selectedLaws').length > 0
        ? searchParams.getAll('selectedLaws')
        : searchParams.get('selectedLaws')
          ? searchParams.get('selectedLaws')!.split(',')
          : [],
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

    const result = await estimateAvailableQuestions(parseResult.data)

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
