// scripts/google-ads/create-administrativo-universidad-murcia.ts
//
// Campaña Search (Maximizar clics · CPC máx 0,05€ · 3€/día) para Administrativo (C1)
// de la Universidad de Murcia. Modelo "de las exitosas" del runbook google-ads-analisis.md.
// CONTEXTO (verificado 13/07/2026): 36 plazas turno libre C1 (BORM R-839/2026 + BOE-A-2026-14469),
//   inscripción ABIERTA (~hasta 31/07/2026), examen FUTURO no antes del 01/09/2026 (base 1.7) →
//   ventana de venta clara. Geo Región de Murcia. Landing sin ranking orgánico (0 impr) → ads da visibilidad.
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-administrativo-universidad-murcia.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-administrativo-universidad-murcia.ts --apply  # CREA (ENABLED)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
const GEO_MURCIA = 'geoTargetConstants/20284' // Region of Murcia (Autonomous Community)
const LANG_ES = 'languageConstants/1003'
const FINAL_URL = 'https://www.vence.es/administrativa-universidad-de-murcia'

const HEADLINES = [
  'Administrativo Univ. Murcia',  // 27
  'Oposición UMU 2026',           // 18
  '36 plazas turno libre',        // 22
  'Tests del temario oficial',    // 25
  'Empieza gratis',               // 14
  'Examen tipo test',             // 16
  'Practica con tests reales',    // 25
]
const DESCRIPTIONS = [
  'Prepara las 36 plazas de Administrativo de la Universidad de Murcia. Tests gratis hoy.', // 86
  'Examen tipo test del temario oficial. Practica por temas y mide tu progreso. Gratis.',   // 84
  'Tests reales de Administrativo Universidad de Murcia. Empieza gratis y sin tarjeta.',     // 83
]
const KEYWORDS = [
  'administrativo universidad de murcia',
  'oposiciones universidad de murcia',
  'oposicion administrativo universidad murcia',
  'tests administrativo universidad murcia',
  'temario administrativo universidad murcia',
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
    { entity: 'campaign_budget', operation: 'create', resource: { resource_name: R('campaignBudgets', -1), name: 'C1 Admin Univ Murcia - budget', amount_micros: 3_000_000, delivery_method: 'STANDARD', explicitly_shared: false } },
    { entity: 'campaign', operation: 'create', resource: { resource_name: R('campaigns', -2), name: 'C1 Administrativo Universidad de Murcia', status, advertising_channel_type: 'SEARCH', campaign_budget: R('campaignBudgets', -1), target_spend: { cpc_bid_ceiling_micros: 50_000 }, network_settings: { target_google_search: true, target_search_network: false, target_content_network: false, target_partner_search_network: false }, contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), location: { geo_target_constant: GEO_MURCIA } } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), language: { language_constant: LANG_ES } } },
    { entity: 'ad_group', operation: 'create', resource: { resource_name: R('adGroups', -3), name: 'C1 Admin Univ Murcia - grupo', campaign: R('campaigns', -2), type: 'SEARCH_STANDARD', status: 'ENABLED' } },
    { entity: 'ad_group_ad', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', ad: { final_urls: [FINAL_URL], responsive_search_ad: { headlines: HEADLINES.map((text) => ({ text })), descriptions: DESCRIPTIONS.map((text) => ({ text })) } } } },
    ...KEYWORDS.map((text) => ({ entity: 'ad_group_criterion', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', keyword: { text, match_type: 'PHRASE' } } })),
  ]
  console.log(`Modo: ${APPLY ? '🔴 APPLY (ENABLED)' : '🔍 DRY-RUN'} · geo Región de Murcia (20284) · 3€/día · CPC máx 0,05€`)
  console.log(`Landing: ${FINAL_URL}`)
  try {
    const res = await customer.mutateResources(operations, { validate_only: !APPLY })
    if (!APPLY) console.log('✅ DRY-RUN OK — validado por Google, nada creado')
    else { console.log('✅ CREADA (ENABLED):'); (res as any).mutate_operation_responses?.forEach((r: any) => { const v = Object.values(r)[0] as any; if (v?.resource_name) console.log('   ' + v.resource_name) }) }
  } catch (e: any) { console.error('❌', e?.message || e); if (e?.errors) console.error(JSON.stringify(e.errors, null, 2)); process.exit(1) }
}
main()
