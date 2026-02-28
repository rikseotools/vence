import { NextRequest, NextResponse } from 'next/server'
import { getVerificationErrors } from '@/lib/api/verify-articles/queries'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lawId = searchParams.get('lawId')
    const limit = parseInt(searchParams.get('limit') || '10')
    const articlesParam = searchParams.get('articles')

    if (!lawId) {
      return NextResponse.json(
        { success: false, error: 'Se requiere lawId' },
        { status: 400 }
      )
    }

    const articleList = articlesParam
      ? articlesParam.split(',').map(a => a.trim())
      : undefined

    const errors = await getVerificationErrors(lawId, limit, articleList)

    return NextResponse.json({
      success: true,
      errors,
      filtered: !!articlesParam,
    })
  } catch (error) {
    console.error('Error obteniendo logs de errores:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}
