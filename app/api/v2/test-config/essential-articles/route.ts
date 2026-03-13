// app/api/v2/test-config/essential-articles/route.ts
// GET /api/v2/test-config/essential-articles?topicNumber=1&positionType=auxiliar_administrativo
import { NextRequest, NextResponse } from 'next/server'
import { safeParseGetEssentialArticles, getEssentialArticles } from '@/lib/api/test-config'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET(request: NextRequest) {
  try {
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

    const result = await getEssentialArticles(parseResult.data)

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
