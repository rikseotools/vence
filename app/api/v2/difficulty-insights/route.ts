// app/api/v2/difficulty-insights/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getDifficultyInsights } from '@/lib/api/difficulty-insights/queries'
import { getDifficultyInsightsRequestSchema } from '@/lib/api/difficulty-insights/schemas'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { withDbTimeout, isDbTimeoutError } from '@/lib/db/timeout'

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

  // Quick-fail 12s. Observado 504 Vercel Runtime Timeout 300s con la query
  // pesada en blips de pool: mejor responder 503 retryable a los 12s que
  // dejar la lambda colgada los 300s del maxDuration de Vercel.
  let result
  try {
    result = await withDbTimeout(
      () => getDifficultyInsights(parseResult.data.userId),
      12000,
    )
  } catch (err) {
    if (isDbTimeoutError(err)) {
      return NextResponse.json(
        { success: false, error: 'Servicio saturado momentáneamente. Reintenta en 5 minutos.', retryable: true },
        { status: 503, headers: { 'Retry-After': '60' } }
      )
    }
    throw err
  }

  if (!result.success) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}

export const GET = withErrorLogging('/api/v2/difficulty-insights', _GET)
