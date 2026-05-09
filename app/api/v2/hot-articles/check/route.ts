// app/api/v2/hot-articles/check/route.ts
// Reemplaza la función RPC check_hot_article_for_current_user
import { NextRequest, NextResponse } from 'next/server'
import { safeParseCheckHotArticleRequest } from '@/lib/api/hot-articles/schemas'
import { checkHotArticleCached } from '@/lib/api/hot-articles/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

// maxDuration bajado a 10s tras cascada del 8 may 23:27 UTC donde este endpoint
// fue uno de los que hit 300s sin protección (504 ×3 simultáneos en el blip).
export const maxDuration = 10

const HOT_ARTICLES_TIMEOUT_MS = 8000

async function _GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const parseResult = safeParseCheckHotArticleRequest({
      articleId: searchParams.get('articleId'),
      userOposicion: searchParams.get('userOposicion'),
      currentOposicion: searchParams.get('currentOposicion'),
    })

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Parámetros inválidos', issues: parseResult.error.issues },
        { status: 400 }
      )
    }

    const result = await withDbTimeout(
      () => checkHotArticleCached(parseResult.data),
      HOT_ARTICLES_TIMEOUT_MS,
    )
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (isDbTimeoutError(error)) {
      console.warn('⏱️ [API/hot-articles] Timeout (quick-fail):', error.timeoutMs, 'ms')
      // Endpoint informativo: en timeout devolver "not hot" (200) para que el
      // cliente no muestre el badge — degradación silenciosa, mejor UX que 503.
      return NextResponse.json({ success: true, isHot: false })
    }
    console.error('❌ [API/hot-articles] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/v2/hot-articles/check', _GET)
