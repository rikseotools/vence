import { NextResponse } from 'next/server'
import { getAllLawsWithVerification } from '@/lib/api/verify-articles/queries'
import { calculateIsOk } from '@/lib/api/verify-articles/ai-helpers'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET() {
  try {
    const lawsList = await getAllLawsWithVerification()

    const statsByLaw: Record<string, unknown> = {}
    let hasDiscrepancies = false

    for (const law of lawsList) {
      const summary = law.lastVerificationSummary as Record<string, unknown> | null
      const isOk = calculateIsOk(summary)

      if (summary && !isOk) {
        hasDiscrepancies = true
      }

      statsByLaw[law.id] = {
        lastVerified: law.lastChecked,
        status: law.verificationStatus,
        isOk,
        summary,
      }
    }

    return NextResponse.json({
      success: true,
      stats: statsByLaw,
      hasDiscrepancies,
    })
  } catch (error) {
    console.error('Error obteniendo stats por ley:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    )
  }
}

export const GET = withErrorLogging('/api/verify-articles/stats-by-law', _GET)
