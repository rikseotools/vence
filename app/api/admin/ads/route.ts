// app/api/admin/ads/route.ts
// Panel admin de Google Ads: rendimiento + ROI por campaña, ordenado por gasto.
// Cruza coste (Google Ads API) con ingreso real atribuido (BD vía Drizzle).
// Solo admin. Mantiene puja por clic — esto es solo lectura para decidir presupuesto.

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getCampaignRoi, GoogleAdsError, type DateRange } from '@/lib/services/googleAds'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 30

const RANGES: DateRange[] = [
  'TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_14_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'LAST_MONTH',
]

function parseRange(raw: string | null): DateRange {
  const up = (raw || '').toUpperCase() as DateRange
  return RANGES.includes(up) ? up : 'LAST_7_DAYS'
}

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const range = parseRange(request.nextUrl.searchParams.get('range'))

  try {
    const campaigns = await getCampaignRoi(range)

    const totals = campaigns.reduce(
      (acc, c) => {
        acc.costEur += c.costEur
        acc.clicks += c.clicks
        acc.impressions += c.impressions
        acc.registrations += c.registrations
        acc.revenueEur += c.revenueEur
        acc.payments += c.payments
        return acc
      },
      { costEur: 0, clicks: 0, impressions: 0, registrations: 0, revenueEur: 0, payments: 0 }
    )

    // Media de €/registro de la cuenta → referencia para el color relativo del panel.
    const avgCostPerRegistration =
      totals.registrations > 0 ? totals.costEur / totals.registrations : null

    return NextResponse.json({
      range,
      ranges: RANGES,
      totals: {
        ...totals,
        avgCostPerRegistration,
        roi: totals.costEur > 0 ? totals.revenueEur / totals.costEur : null,
        cpaEur: totals.payments > 0 ? totals.costEur / totals.payments : null,
      },
      campaigns,
    })
  } catch (e) {
    if (e instanceof GoogleAdsError) {
      return NextResponse.json({ error: `Google Ads: ${e.message}` }, { status: 502 })
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/admin/ads', _GET)
