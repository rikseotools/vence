// scripts/google-ads/create-administrativo-universidad-leon.ts
//
// Campaña Search (Maximizar clics · CPC máx 0,05€ · 3€/día) para Administrativo (C1) de la
// Universidad de León. Modelo del runbook google-ads-analisis.md.
// CONTEXTO (13/07/2026): 11 plazas turno libre C1 (BOE-A-2026-13617 + BOCYL). Inscripción cerraba
//   ~13-14/07/2026; sin lista de admitidos ni fecha → examen FUTURO temprano, PREVISIÓN ~inicios 2027.
//   Geo Castilla y León (Universidad de León). Slow-burn (Manuel opción 2).
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-administrativo-universidad-leon.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-administrativo-universidad-leon.ts --apply  # CREA (ENABLED)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
const GEO = 'geoTargetConstants/20275' // Castile and Leon
const LANG_ES = 'languageConstants/1003'
const FINAL_URL = 'https://www.vence.es/administrativo-universidad-leon'

const HEADLINES = [
  'Administrativo Univ. León',    // 25
  'Oposición Universidad León',   // 26
  '11 plazas turno libre',        // 21
  'Tests del temario oficial',    // 25
  'Empieza gratis',               // 14
  'Examen tipo test',             // 16
  'Practica con tests reales',    // 25
]
const DESCRIPTIONS = [
  'Prepara las 11 plazas de Administrativo de la Universidad de León. Tests gratis hoy.', // 84
  'Examen tipo test del temario oficial. Practica por temas y mide tu progreso. Gratis.', // 84
  'Tests reales de Administrativo Universidad de León. Empieza gratis y sin tarjeta.',     // 80
]
const KEYWORDS = [
  'administrativo universidad de leon',
  'oposiciones universidad de leon',
  'oposicion administrativo universidad leon',
  'tests administrativo universidad leon',
  'temario administrativo universidad leon',
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
    { entity: 'campaign_budget', operation: 'create', resource: { resource_name: R('campaignBudgets', -1), name: 'C1 Admin Univ Leon - budget', amount_micros: 3_000_000, delivery_method: 'STANDARD', explicitly_shared: false } },
    { entity: 'campaign', operation: 'create', resource: { resource_name: R('campaigns', -2), name: 'C1 Administrativo Universidad de León', status, advertising_channel_type: 'SEARCH', campaign_budget: R('campaignBudgets', -1), target_spend: { cpc_bid_ceiling_micros: 50_000 }, network_settings: { target_google_search: true, target_search_network: false, target_content_network: false, target_partner_search_network: false }, contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), location: { geo_target_constant: GEO } } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), language: { language_constant: LANG_ES } } },
    { entity: 'ad_group', operation: 'create', resource: { resource_name: R('adGroups', -3), name: 'C1 Admin Univ Leon - grupo', campaign: R('campaigns', -2), type: 'SEARCH_STANDARD', status: 'ENABLED' } },
    { entity: 'ad_group_ad', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', ad: { final_urls: [FINAL_URL], responsive_search_ad: { headlines: HEADLINES.map((text) => ({ text })), descriptions: DESCRIPTIONS.map((text) => ({ text })) } } } },
    ...KEYWORDS.map((text) => ({ entity: 'ad_group_criterion', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', keyword: { text, match_type: 'PHRASE' } } })),
  ]
  console.log(`Modo: ${APPLY ? '🔴 APPLY (ENABLED)' : '🔍 DRY-RUN'} · geo Castilla y León (20275) · 3€/día · CPC máx 0,05€ · ${FINAL_URL}`)
  try {
    const res = await customer.mutateResources(operations, { validate_only: !APPLY })
    if (!APPLY) console.log('✅ DRY-RUN OK')
    else { console.log('✅ CREADA (ENABLED):'); (res as any).mutate_operation_responses?.forEach((r: any) => { const v = Object.values(r)[0] as any; if (v?.resource_name?.includes('/campaigns/')) console.log('   ' + v.resource_name) }) }
  } catch (e: any) { console.error('❌', e?.message || e); if (e?.errors) console.error(JSON.stringify(e.errors, null, 2)); process.exit(1) }
}
main()
