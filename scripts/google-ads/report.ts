// scripts/google-ads/report.ts
//
// CLI fino sobre la capa de servicio: informe de rendimiento de campañas.
// Toda la lógica vive en lib/services/googleAds — este script solo formatea.
//
//   npm run ads:report                 # últimos 7 días
//   npm run ads:report -- LAST_30_DAYS # otro rango
//
//   Rangos: TODAY YESTERDAY LAST_7_DAYS LAST_14_DAYS LAST_30_DAYS THIS_MONTH LAST_MONTH

import { getCampaignPerformance, GoogleAdsError, type DateRange } from '@/lib/services/googleAds'

const VALID: DateRange[] = [
  'TODAY',
  'YESTERDAY',
  'LAST_7_DAYS',
  'LAST_14_DAYS',
  'LAST_30_DAYS',
  'THIS_MONTH',
  'LAST_MONTH',
]

const arg = (process.argv[2] || 'LAST_7_DAYS').toUpperCase() as DateRange
const range: DateRange = VALID.includes(arg) ? arg : 'LAST_7_DAYS'

const eur = (n: number) => `${n.toFixed(2)}€`

async function main() {
  const rows = await getCampaignPerformance(range)

  if (rows.length === 0) {
    console.log(`Sin datos de campañas en ${range}.`)
    return
  }

  console.log(`\n📊 Rendimiento de campañas — ${range} (${rows.length})\n`)
  let totalCost = 0
  let totalConv = 0
  for (const r of rows) {
    totalCost += r.costEur
    totalConv += r.conversions
    console.log(
      `• ${r.name} [${r.status}] · puja: ${r.biddingStrategyType}\n` +
        `   ${eur(r.costEur)} · ${r.clicks} clics · ${r.impressions} impr · ` +
        `CPC ${eur(r.avgCpcEur)} · ${r.conversions.toFixed(1)} conv · ` +
        `valor ${eur(r.conversionsValueEur)} · ROAS ${r.roas?.toFixed(2) ?? '—'}`
    )
  }
  console.log(`\n  TOTAL: ${eur(totalCost)} de gasto · ${totalConv.toFixed(1)} conversiones\n`)
}

main().catch((e) => {
  if (e instanceof GoogleAdsError) {
    console.error('❌ Google Ads:', e.message)
    if (e.requestId) console.error('   request_id:', e.requestId)
  } else {
    console.error('❌', (e as Error).message)
  }
  process.exit(1)
})
