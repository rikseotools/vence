// app/api/v2/psychometric-stats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPsychometricStats } from '@/lib/api/psychometric-stats/queries'
import { getPsychometricStatsRequestSchema } from '@/lib/api/psychometric-stats/schemas'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function _GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const userId = searchParams.get('userId')

  const parseResult = getPsychometricStatsRequestSchema.safeParse({ userId })
  if (!parseResult.success) {
    return NextResponse.json(
      { success: false, error: 'userId inválido o faltante' },
      { status: 400 }
    )
  }

  const result = await getPsychometricStats(parseResult.data.userId)

  if (!result.success) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}

export const GET = withErrorLogging('/api/v2/psychometric-stats', _GET)
