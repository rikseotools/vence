// app/api/v2/test-config/articles/route.ts
// GET /api/v2/test-config/articles?lawShortName=CE&topicNumber=1&positionType=auxiliar_administrativo
import { NextRequest, NextResponse } from 'next/server'
import { safeParseGetArticles, getArticlesForLaw } from '@/lib/api/test-config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const rawData = {
      lawShortName: searchParams.get('lawShortName') || undefined,
      topicNumber: searchParams.get('topicNumber') ? Number(searchParams.get('topicNumber')) : null,
      positionType: searchParams.get('positionType') || undefined,
      includeOfficialCount: searchParams.get('includeOfficialCount') === 'true',
    }

    const parseResult = safeParseGetArticles(rawData)

    if (!parseResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Parámetros inválidos',
        details: parseResult.error.issues,
      }, { status: 400 })
    }

    const result = await getArticlesForLaw(parseResult.data)

    if (!result.success) {
      return NextResponse.json(result, { status: 500 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [API/v2/test-config/articles] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
