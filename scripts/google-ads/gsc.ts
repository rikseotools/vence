// scripts/google-ads/gsc.ts
// Búsquedas orgánicas reales (Search Console) de una oposición → keywords gratis.
//   npm run gsc:keywords -- auxiliar-administrativo-carm
//   npm run gsc:keywords            (sin slug → top global)

import { getTopQueriesForSlug, querySearchAnalytics } from '@/lib/services/googleSearchConsole'

const slug = process.argv[2]

async function main() {
  if (!slug) {
    const end = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10)
    const start = new Date(Date.now() - 31 * 86_400_000).toISOString().slice(0, 10)
    const rows = await querySearchAnalytics({ startDate: start, endDate: end, dimensions: ['query'], rowLimit: 25 })
    console.log(`\n🔎 Top búsquedas orgánicas globales (${start}…${end})\n`)
    for (const r of rows) console.log(`  ${String(r.clicks).padStart(4)} clics · pos ${r.position.toFixed(1)} · CTR ${(r.ctr * 100).toFixed(0)}% · ${r.keys[0]}`)
    return
  }
  const qs = await getTopQueriesForSlug(slug)
  console.log(`\n🔎 Búsquedas orgánicas de "${slug}" (~28d)\n`)
  if (!qs.length) { console.log('  (sin datos — ¿slug correcto?)'); return }
  for (const q of qs) console.log(`  ${String(q.clicks).padStart(4)} clics · ${String(q.impressions).padStart(5)} impr · pos ${q.position.toFixed(1)} · ${q.query}`)
}

main().catch((e) => { console.error('❌', (e as Error).message); process.exit(1) })
