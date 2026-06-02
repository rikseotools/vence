// scripts/google-ads/roi.ts
//
// ROI por campaña: coste (API) vs ingreso real (BD). Para decidir dónde subir
// presupuesto manteniendo puja por clic.
//
//   npm run ads:roi                 # últimos 30 días
//   npm run ads:roi -- LAST_7_DAYS  # otra ventana

import { getCampaignRoi, GoogleAdsError, type DateRange } from '@/lib/services/googleAds'

const VALID: DateRange[] = [
  'TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_14_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'LAST_MONTH',
]
const arg = (process.argv[2] || 'LAST_30_DAYS').toUpperCase() as DateRange
const range: DateRange = VALID.includes(arg) ? arg : 'LAST_30_DAYS'

const eur = (n: number) => `${n.toFixed(2)}€`

async function main() {
  const rows = await getCampaignRoi(range)
  if (rows.length === 0) {
    console.log(`Sin datos en ${range}.`)
    return
  }

  console.log(`\n💰 ROI por campaña — ${range}\n`)
  let totalCost = 0
  let totalRev = 0
  for (const r of rows) {
    totalCost += r.costEur
    totalRev += r.revenueEur
    const cpa = r.cpaEur != null ? eur(r.cpaEur) : '—'
    const roi = r.roi != null ? `${r.roi.toFixed(2)}×` : '—'
    const flag =
      r.costEur > 0 && r.payments === 0 ? '  🔴 0 ventas'
      : r.roi != null && r.roi >= 1 ? '  🟢 rentable'
      : r.roi != null && r.roi > 0 ? '  🟡 por debajo de 1×'
      : ''
    console.log(
      `• ${r.name} [${r.campaignId}]\n` +
        `   coste ${eur(r.costEur)} · ingreso ${eur(r.revenueEur)} · ${r.payments} ventas · ` +
        `CPA ${cpa} · ROI ${roi}${flag}`
    )
  }

  const totalRoi = totalCost > 0 ? (totalRev / totalCost).toFixed(2) : '—'
  console.log(`\n  TOTAL: coste ${eur(totalCost)} · ingreso ${eur(totalRev)} · ROI ${totalRoi}×\n`)

  // Recomendación simple: escalar las rentables, revisar las de 0 ventas.
  const escalar = rows.filter((r) => r.roi != null && r.roi >= 1).map((r) => r.name)
  const revisar = rows.filter((r) => r.costEur > 0 && r.payments === 0).map((r) => r.name)
  if (escalar.length) console.log(`  🟢 Subir presupuesto: ${escalar.join(', ')}`)
  if (revisar.length) console.log(`  🔴 Revisar/pausar (gasto sin ventas): ${revisar.join(', ')}`)
  if (totalRev === 0) {
    console.log(
      `\n  ℹ️ Ingreso 0: la atribución solo existe para registros posteriores al\n` +
        `     despliegue de /api/acquisition. Vuelve a ejecutarlo cuando haya volumen.`
    )
  }
  console.log('')
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
