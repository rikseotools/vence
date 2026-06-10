// scripts/google-ads/create-tcae-published.ts
//
// Crea campañas Search (Maximizar clics · CPC máx 0,05€ · 3€/día) para las TCAE
// YA PUBLICADAS que aún no tenían anuncio. Mismo "modelo de las exitosas" del
// runbook google-ads-analisis.md que create-tcae-sas.ts. Prioridad: examen próximo.
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-tcae-published.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-tcae-published.ts --apply    # CREA (ENABLED)
//   npx tsx --env-file=.env.local scripts/google-ads/create-tcae-published.ts --apply --only=osakidetza

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
const ONLY = process.argv.find(a => a.startsWith('--only='))?.split('=')[1]
const LANG_ES = 'languageConstants/1003'

type Camp = {
  key: string
  name: string
  geo: string
  url: string
  headlines: string[]   // ≤30
  descriptions: string[] // ≤90
  keywords: string[]
}

const CAMPAIGNS: Camp[] = [
  {
    key: 'osakidetza',
    name: 'TCAE Osakidetza (País Vasco)',
    geo: 'geoTargetConstants/20289',
    url: 'https://www.vence.es/auxiliar-enfermeria-osakidetza',
    headlines: ['TCAE Osakidetza', 'Auxiliar Enfermería Euskadi', 'Tests del temario oficial', 'Empieza gratis', 'Oposición TCAE Osakidetza', 'Practica con tests reales'],
    descriptions: [
      'Prepara la oposición de TCAE de Osakidetza. Tests gratis del temario oficial.',
      'Practica con tests tipo examen de Auxiliar de Enfermería del Servicio Vasco. Gratis.',
      'Mide tu progreso con tests de TCAE de Osakidetza. Empieza gratis hoy.',
    ],
    keywords: ['tcae osakidetza', 'auxiliar de enfermeria osakidetza', 'oposicion tcae pais vasco', 'tcae euskadi', 'auxiliar enfermeria servicio vasco de salud'],
  },
  {
    key: 'sermas',
    name: 'TCAE SERMAS Madrid',
    geo: 'geoTargetConstants/20282',
    url: 'https://www.vence.es/tcae-sermas-madrid',
    headlines: ['TCAE SERMAS Madrid', 'Auxiliar Enfermería Madrid', '1.023 plazas', 'Tests del temario oficial', 'Empieza gratis', 'Oposición TCAE Madrid'],
    descriptions: [
      'Prepara la oposición de TCAE del SERMAS (Madrid). 1.023 plazas. Tests gratis.',
      'Practica con tests tipo examen de Auxiliar de Enfermería del SERMAS. Empieza gratis.',
      'Tests del temario oficial de TCAE Madrid. Mide tu progreso hoy mismo.',
    ],
    keywords: ['tcae sermas', 'tcae madrid', 'auxiliar de enfermeria madrid', 'oposicion tcae servicio madrileño de salud', 'auxiliar enfermeria sermas'],
  },
  {
    key: 'canarias',
    name: 'TCAE Canarias (SCS)',
    geo: 'geoTargetConstants/20277',
    url: 'https://www.vence.es/tcae-canarias',
    headlines: ['TCAE Canarias', 'Auxiliar Enfermería Canarias', 'Tests del temario oficial', 'Empieza gratis', 'Oposición TCAE Canarias', 'Practica con tests reales'],
    descriptions: [
      'Prepara la oposición de TCAE del Servicio Canario de Salud. Tests gratis.',
      'Practica con tests tipo examen de Auxiliar de Enfermería del SCS. Empieza gratis.',
      'Tests del temario oficial de TCAE Canarias. Mide tu progreso hoy.',
    ],
    keywords: ['tcae canarias', 'auxiliar de enfermeria canarias', 'oposicion tcae servicio canario de salud', 'tcae scs', 'auxiliar enfermeria servicio canario de salud'],
  },
  {
    key: 'galicia',
    name: 'TCAE SERGAS (Galicia)',
    geo: 'geoTargetConstants/20280',
    url: 'https://www.vence.es/tcae-galicia',
    headlines: ['TCAE SERGAS', 'Auxiliar Enfermería Galicia', 'Tests del temario oficial', 'Empieza gratis', 'Oposición TCAE Galicia', 'Practica con tests reales'],
    descriptions: [
      'Prepara la oposición de TCAE del SERGAS (Galicia). Tests gratis del temario.',
      'Practica con tests tipo examen de Auxiliar de Enfermería del SERGAS. Empieza gratis.',
      'Tests del temario oficial de TCAE Galicia. Mide tu progreso hoy.',
    ],
    keywords: ['tcae sergas', 'tcae galicia', 'auxiliar de enfermeria galicia', 'oposicion tcae sergas', 'auxiliar enfermeria servizo galego de saude'],
  },
  {
    key: 'murcia',
    name: 'TCAE SMS (Murcia)',
    geo: 'geoTargetConstants/20284',
    url: 'https://www.vence.es/tcae-murcia',
    headlines: ['TCAE Murcia', 'Auxiliar Enfermería Murcia', 'Tests del temario oficial', 'Empieza gratis', 'Oposición TCAE Murcia', 'Practica con tests reales'],
    descriptions: [
      'Prepara la oposición de TCAE del Servicio Murciano de Salud. Tests gratis.',
      'Practica con tests tipo examen de Auxiliar de Enfermería del SMS. Empieza gratis.',
      'Tests del temario oficial de TCAE Murcia. Mide tu progreso hoy.',
    ],
    keywords: ['tcae murcia', 'auxiliar de enfermeria murcia', 'oposicion tcae servicio murciano de salud', 'tcae sms', 'auxiliar enfermeria servicio murciano de salud'],
  },
]

function assertLimits(c: Camp) {
  const badH = c.headlines.filter(h => h.length > 30)
  const badD = c.descriptions.filter(d => d.length > 90)
  if (badH.length) throw new Error(`[${c.key}] Titulares >30: ${JSON.stringify(badH)}`)
  if (badD.length) throw new Error(`[${c.key}] Descripciones >90: ${JSON.stringify(badD)}`)
  if (c.headlines.length < 3 || c.descriptions.length < 2) throw new Error(`[${c.key}] RSA mínimos`)
}

async function createOne(c: Camp) {
  assertLimits(c)
  const customer = getGoogleAdsCustomer()
  const cid = loadAdsConfig().customerId
  const R = (entity: string, id: number) => `customers/${cid}/${entity}/${id}`
  const status = APPLY ? 'ENABLED' : 'PAUSED'

  const operations: any[] = [
    { entity: 'campaign_budget', operation: 'create', resource: { resource_name: R('campaignBudgets', -1), name: `${c.name} - budget`, amount_micros: 3_000_000, delivery_method: 'STANDARD', explicitly_shared: false } },
    { entity: 'campaign', operation: 'create', resource: { resource_name: R('campaigns', -2), name: c.name, status, advertising_channel_type: 'SEARCH', campaign_budget: R('campaignBudgets', -1), target_spend: { cpc_bid_ceiling_micros: 50_000 }, network_settings: { target_google_search: true, target_search_network: false, target_content_network: false, target_partner_search_network: false }, contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), location: { geo_target_constant: c.geo } } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), language: { language_constant: LANG_ES } } },
    { entity: 'ad_group', operation: 'create', resource: { resource_name: R('adGroups', -3), name: `${c.name} - grupo`, campaign: R('campaigns', -2), type: 'SEARCH_STANDARD', status: 'ENABLED' } },
    { entity: 'ad_group_ad', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', ad: { final_urls: [c.url], responsive_search_ad: { headlines: c.headlines.map(text => ({ text })), descriptions: c.descriptions.map(text => ({ text })) } } } },
    ...c.keywords.map(text => ({ entity: 'ad_group_criterion', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', keyword: { text, match_type: 'PHRASE' } } })),
  ]

  const res = await customer.mutateResources(operations, { validate_only: !APPLY })
  if (!APPLY) {
    console.log(`  🔍 [${c.key}] DRY-RUN OK → ${c.url} (geo ${c.geo.split('/')[1]})`)
  } else {
    const campRes = (res as any).mutate_operation_responses?.find((r: any) => Object.keys(r)[0] === 'campaign_result')
    const rn = campRes ? (Object.values(campRes)[0] as any).resource_name : '?'
    console.log(`  ✅ [${c.key}] CREADA → ${rn} → ${c.url}`)
  }
}

async function main() {
  const list = ONLY ? CAMPAIGNS.filter(c => c.key === ONLY) : CAMPAIGNS
  console.log(`Modo: ${APPLY ? '🔴 APPLY (ENABLED, gasto real)' : '🔍 DRY-RUN'} · ${list.length} campañas · 3€/día · CPC máx 0,05€`)
  for (const c of list) {
    try { await createOne(c) }
    catch (e: any) { console.error(`  ❌ [${c.key}] ERROR:`, e?.message || e); if (e?.errors) console.error(JSON.stringify(e.errors, null, 2)) }
  }
}

main()
