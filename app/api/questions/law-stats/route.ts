// app/api/questions/law-stats/route.ts
// Endpoint para obtener estadísticas de preguntas por ley.
// Usado por client components (LawTestConfigurator).
// Server components llaman a queryLawStats() directamente.

import { NextRequest, NextResponse } from 'next/server'
import { queryLawStats } from '@/lib/api/law-stats/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function _GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lawShortName = searchParams.get('lawShortName')

  if (!lawShortName) {
    return NextResponse.json(
      { success: false, error: 'Falta parámetro lawShortName' },
      { status: 400 }
    )
  }

  const result = await queryLawStats(lawShortName)

  if (!result.success) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}

export const GET = withErrorLogging('/api/questions/law-stats', _GET)
