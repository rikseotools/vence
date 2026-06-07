// scripts/google-ads/cpc-experiment.ts
//
// Lectura del experimento de TECHO DE CPC (diferencia-en-diferencias).
// Compara las campañas TRATADAS (techo subido) contra el resto (control, a 0,05€)
// usando métricas insensibles al volumen de búsqueda: cuota de impresiones e
// impresiones perdidas por ranking. Así el "efecto examen" no contamina la lectura.
//
//   npx tsx --env-file=.env.local scripts/google-ads/cpc-experiment.ts [RANGO]
//
// RANGO: LAST_7_DAYS (def), LAST_14_DAYS, LAST_30_DAYS, YESTERDAY...

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'

// IDs de las campañas TRATADAS (techo de CPC subido). Editar si cambia el experimento.
const TREATED = new Set(['23727564870', '23745484739']) // carm, seg. social

const range = (process.argv[2] || 'LAST_7_DAYS').toUpperCase()
const pct = (x: unknown) => (x == null ? '  —' : `${(Number(x) * 100).toFixed(0)}%`.padStart(4))
const eur = (x: unknown) => `${(Number(x ?? 0) / 1e6).toFixed(3)}€`

async function main() {
  const c = getGoogleAdsCustomer()
  const rows: any[] = await c.query(`
    SELECT campaign.id, campaign.name, campaign.target_spend.cpc_bid_ceiling_micros,
           metrics.search_impression_share,
           metrics.search_top_impression_share,
           metrics.search_absolute_top_impression_share,
           metrics.search_rank_lost_impression_share,
           metrics.average_cpc, metrics.clicks, metrics.impressions, metrics.cost_micros,
           metrics.conversions
    FROM campaign
    WHERE campaign.status='ENABLED' AND segments.date DURING ${range}
    ORDER BY metrics.cost_micros DESC`)

  const fmt = (r: any) => {
    const m = r.metrics, ca = r.campaign
    const ceil = ca.target_spend?.cpc_bid_ceiling_micros
    return (
      `  ${(ca.name as string).padEnd(34)} techo ${ceil == null ? '   —' : eur(ceil).padStart(6)} | ` +
      `IS ${pct(m.search_impression_share)} top ${pct(m.search_top_impression_share)} ` +
      `absTop ${pct(m.search_absolute_top_impression_share)} perdRank ${pct(m.search_rank_lost_impression_share)} | ` +
      `CPC ${eur(m.average_cpc)} clics ${String(m.clicks).padStart(4)} ` +
      `coste ${(Number(m.cost_micros ?? 0) / 1e6).toFixed(2)}€ reg ${Number(m.conversions ?? 0).toFixed(0)}`
    )
  }

  const treated = rows.filter((r) => TREATED.has(String(r.campaign.id)))
  const control = rows.filter((r) => !TREATED.has(String(r.campaign.id)) && Number(r.metrics.impressions) > 0)

  console.log(`\n🧪 Experimento techo CPC — ${range}\n`)
  console.log('TRATADAS (techo subido):')
  treated.forEach((r) => console.log(fmt(r)))
  console.log('\nCONTROL (resto con impresiones, deberían seguir ~0,05€):')
  control.forEach((r) => console.log(fmt(r)))

  const avgIS = (rs: any[]) =>
    rs.length ? rs.reduce((s, r) => s + Number(r.metrics.search_impression_share ?? 0), 0) / rs.length : 0
  console.log(
    `\n  Cuota impr. media → tratadas ${(avgIS(treated) * 100).toFixed(0)}% vs control ${(avgIS(control) * 100).toFixed(0)}%`
  )
  console.log('  (clave: si la IS de las tratadas sube y la del control no, es la puja, no el examen)\n')
}

main().catch((e) => {
  console.error('❌', (e as Error).message)
  process.exit(1)
})
