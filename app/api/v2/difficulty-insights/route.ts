// app/api/v2/difficulty-insights/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDifficultyInsights } from '@/lib/api/difficulty-insights/queries'
import { getDifficultyInsightsRequestSchema } from '@/lib/api/difficulty-insights/schemas'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function _GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userId = searchParams.get('userId')

  const parseResult = getDifficultyInsightsRequestSchema.safeParse({ userId })
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: 'userId inválido o faltante' },
      { status: 400 }
    )
  }

  const result = await getDifficultyInsights(parseResult.data.userId)

  if (!result.success) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}

export const GET = withErrorLogging('/api/v2/difficulty-insights', _GET)
