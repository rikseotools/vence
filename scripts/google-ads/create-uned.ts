// scripts/google-ads/create-uned.ts
//
// Campaña Search (Maximizar clics · CPC máx 0,05€ · 3€/día) para Aux. Admin. UNED.
// Mismo "modelo de las exitosas" del runbook que create-tcae-sas.ts.
// CONTEXTO: 54 plazas (BOE 28/05/2026), inscripción abierta (cierra 25/06/2026),
//   examen test 90 preguntas (~otoño 2026 → buen margen). Geo Madrid (plazas en Madrid).
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-uned.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-uned.ts --apply    # CREA (ENABLED)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
const GEO_MADRID = 'geoTargetConstants/20282'
const LANG_ES = 'languageConstants/1003'
const FINAL_URL = 'https://www.vence.es/auxiliar-administrativo-universidad-uned'

const HEADLINES = [
  'Aux. Administrativo UNED',     // 24
  'Oposición UNED 2026',          // 20
  '54 plazas en Madrid',          // 20
  'Tests del temario oficial',    // 26
  'Empieza gratis',               // 14
  'Examen tipo test',             // 17
  'Practica con tests reales',    // 26
]
const DESCRIPTIONS = [
  'Prepara las 54 plazas de Auxiliar Administrativo de la UNED. Tests gratis hoy.',        // 79
  'Examen test de 90 preguntas. Practica la parte general y ofimática del temario. Gratis.',// 88
  'Tests tipo examen de Aux. Administrativo UNED. Mide tu progreso y empieza gratis.',      // 82
]
const KEYWORDS = [
  'auxiliar administrativo uned',
  'oposiciones uned',
  'oposicion auxiliar administrativo uned',
  'tests auxiliar administrativo uned',
  'temario auxiliar administrativo uned',
]

function assertLimits() {
  const badH = HEADLINES.filter((h) => h.length > 30)
  const badD = DESCRIPTIONS.filter((d) => d.length > 90)
  if (badH.length) throw new Error('Titulares >30: ' + JSON.stringify(badH))
  if (badD.length) throw new Error('Descripciones >90: ' + JSON.stringify(badD))
}

async function main() {
  assertLimits()
  const customer = getGoogleAdsCustomer()
  const cid = loadAdsConfig().customerId
  const R = (e: string, id: number) => `customers/${cid}/${e}/${id}`
  const status = APPLY ? 'ENABLED' : 'PAUSED'
  const operations: any[] = [
    { entity: 'campaign_budget', operation: 'create', resource: { resource_name: R('campaignBudgets', -1), name: 'C2 Aux Admin UNED - budget', amount_micros: 3_000_000, delivery_method: 'STANDARD', explicitly_shared: false } },
    { entity: 'campaign', operation: 'create', resource: { resource_name: R('campaigns', -2), name: 'C2 Auxiliar Administrativo UNED', status, advertising_channel_type: 'SEARCH', campaign_budget: R('campaignBudgets', -1), target_spend: { cpc_bid_ceiling_micros: 50_000 }, network_settings: { target_google_search: true, target_search_network: false, target_content_network: false, target_partner_search_network: false }, contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), location: { geo_target_constant: GEO_MADRID } } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), language: { language_constant: LANG_ES } } },
    { entity: 'ad_group', operation: 'create', resource: { resource_name: R('adGroups', -3), name: 'C2 Aux Admin UNED - grupo', campaign: R('campaigns', -2), type: 'SEARCH_STANDARD', status: 'ENABLED' } },
    { entity: 'ad_group_ad', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', ad: { final_urls: [FINAL_URL], responsive_search_ad: { headlines: HEADLINES.map((text) => ({ text })), descriptions: DESCRIPTIONS.map((text) => ({ text })) } } } },
    ...KEYWORDS.map((text) => ({ entity: 'ad_group_criterion', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', keyword: { text, match_type: 'PHRASE' } } })),
  ]
  console.log(`Modo: ${APPLY ? '🔴 APPLY (ENABLED)' : '🔍 DRY-RUN'} · geo Madrid · 3€/día · CPC máx 0,05€`)
  try {
    const res = await customer.mutateResources(operations, { validate_only: !APPLY })
    if (!APPLY) console.log('✅ DRY-RUN OK')
    else { console.log('✅ CREADA:'); (res as any).mutate_operation_responses?.forEach((r: any) => { const v = Object.values(r)[0] as any; if (v?.resource_name) console.log('   ' + v.resource_name) }) }
  } catch (e: any) { console.error('❌', e?.message || e); if (e?.errors) console.error(JSON.stringify(e.errors, null, 2)); process.exit(1) }
}
main()
