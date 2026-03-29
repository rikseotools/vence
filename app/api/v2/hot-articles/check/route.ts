// app/api/v2/hot-articles/check/route.ts
// Reemplaza la función RPC check_hot_article_for_current_user
import { NextRequest, NextResponse } from 'next/server'
import { safeParseCheckHotArticleRequest } from '@/lib/api/hot-articles/schemas'
import { checkHotArticle } from '@/lib/api/hot-articles/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
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

  const result = await checkHotArticle(parseResult.data)
  return NextResponse.json({ success: true, ...result })
}

export const GET = withErrorLogging('/api/v2/hot-articles/check', _GET)
