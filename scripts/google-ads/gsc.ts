// scripts/google-ads/gsc.ts
// Search Console: keywords por oposición y oportunidades SEO.
//   npm run gsc:keywords -- <slug>     búsquedas orgánicas de una oposición
//   npm run gsc:keywords               top global
//   npm run gsc:seo                     oportunidades SEO (demanda + distancia de tiro) con tendencia

import {
  getTopQueriesForSlug,
  getSeoOpportunities,
  querySearchAnalytics,
} from '@/lib/services/googleSearchConsole'

const arg = process.argv[2]

async function seo() {
  const opps = await getSeoOpportunities()
  console.log(`\n🚀 Oportunidades SEO (~28d) — demanda alta + posición 4-20 (distancia de tiro)\n`)
  console.log('  impresiones · pos (Δ vs mes anterior) · clics · búsqueda')
  for (const o of opps.slice(0, 25)) {
    const trend =
      o.positionDelta == null ? 'nuevo'
      : o.positionDelta > 0.3 ? `↑${o.positionDelta.toFixed(1)}`
      : o.positionDelta < -0.3 ? `↓${(-o.positionDelta).toFixed(1)}`
      : '='
    console.log(
      `  ${String(o.impressions).padStart(5)} · pos ${o.position.toFixed(1).padStart(4)} (${trend.padStart(5)}) · ${String(o.clicks).padStart(3)} clics · ${o.query}`
    )
  }
  console.log('\n  ↑ = ha subido (mejor) · ↓ = ha bajado · revisa de nuevo en 3-4 semanas tras los cambios.\n')
}

async function keywords(slug: string) {
  const qs = await getTopQueriesForSlug(slug)
  console.log(`\n🔎 Búsquedas orgánicas de "${slug}" (~28d)\n`)
  if (!qs.length) return console.log('  (sin datos — ¿slug correcto?)')
  for (const q of qs)
    console.log(`  ${String(q.clicks).padStart(4)} clics · ${String(q.impressions).padStart(5)} impr · pos ${q.position.toFixed(1)} · ${q.query}`)
}

async function globalTop() {
  const end = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
  const start = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10)
  const rows = await querySearchAnalytics({ startDate: start, endDate: end, dimensions: ['query'], rowLimit: 25 })
  console.log(`\n🔎 Top búsquedas orgánicas globales (${start}…${end})\n`)
  for (const r of rows)
    console.log(`  ${String(r.clicks).padStart(4)} clics · pos ${r.position.toFixed(1)} · ${r.keys[0]}`)
}

async function main() {
  if (arg === 'seo') return seo()
  if (arg) return keywords(arg)
  return globalTop()
}

main().catch((e) => {
  console.error('❌', (e as Error).message)
  process.exit(1)
})
