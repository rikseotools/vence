// scripts/google-ads/create-auxiliar-archivos-estado.ts
//
// Campaña Search (Maximizar clics · CPC máx 0,05€ · 3€/día) para Auxiliar de Archivos del Estado
// (Sección Archivos, C2). Oposición NACIONAL → geo España. Runbook google-ads-analisis.md.
// CONTEXTO (13/07/2026): OEP 2026 aprobada (RD 387/2026, BOE-A-2026-9946): 86 plazas escala ABM,
//   ~31 estimadas Archivos (proporción histórica, NO oficial). Convocatoria sin publicar → examen
//   PREVISIÓN ~2027. Landing recién construida (48/48 temas). Slow-burn (Manuel opción 2).
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-auxiliar-archivos-estado.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-auxiliar-archivos-estado.ts --apply  # CREA (ENABLED)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
const GEO = 'geoTargetConstants/2724' // España (oposición nacional)
const LANG_ES = 'languageConstants/1003'
const FINAL_URL = 'https://www.vence.es/auxiliar-archivos-estado'

const HEADLINES = [
  'Auxiliar de Archivos',         // 20
  'Oposición Archivos Estado',    // 25
  'Archivos, Bibliotecas Museos', // 28
  'Tests del temario oficial',    // 25
  'Empieza gratis',               // 14
  'Examen tipo test',             // 16
  'Practica con tests reales',    // 25
]
const DESCRIPTIONS = [
  'Prepara Auxiliar de Archivos del Estado (Sección Archivos). Tests gratis del temario.', // 85
  'Examen tipo test del temario oficial. Practica por temas y mide tu progreso. Gratis.',  // 84
  'Tests reales de Auxiliar de Archivos del Estado. Empieza gratis y sin tarjeta.',         // 77
]
const KEYWORDS = [
  'auxiliar de archivos del estado',
  'oposiciones auxiliar archivos',
  'auxiliar archivos bibliotecas museos',
  'tests auxiliar archivos estado',
  'temario auxiliar archivos estado',
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
    { entity: 'campaign_budget', operation: 'create', resource: { resource_name: R('campaignBudgets', -1), name: 'C2 Aux Archivos Estado - budget', amount_micros: 3_000_000, delivery_method: 'STANDARD', explicitly_shared: false } },
    { entity: 'campaign', operation: 'create', resource: { resource_name: R('campaigns', -2), name: 'C2 Auxiliar de Archivos del Estado', status, advertising_channel_type: 'SEARCH', campaign_budget: R('campaignBudgets', -1), target_spend: { cpc_bid_ceiling_micros: 50_000 }, network_settings: { target_google_search: true, target_search_network: false, target_content_network: false, target_partner_search_network: false }, contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), location: { geo_target_constant: GEO } } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), language: { language_constant: LANG_ES } } },
    { entity: 'ad_group', operation: 'create', resource: { resource_name: R('adGroups', -3), name: 'C2 Aux Archivos Estado - grupo', campaign: R('campaigns', -2), type: 'SEARCH_STANDARD', status: 'ENABLED' } },
    { entity: 'ad_group_ad', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', ad: { final_urls: [FINAL_URL], responsive_search_ad: { headlines: HEADLINES.map((text) => ({ text })), descriptions: DESCRIPTIONS.map((text) => ({ text })) } } } },
    ...KEYWORDS.map((text) => ({ entity: 'ad_group_criterion', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', keyword: { text, match_type: 'PHRASE' } } })),
  ]
  console.log(`Modo: ${APPLY ? '🔴 APPLY (ENABLED)' : '🔍 DRY-RUN'} · geo España (2724) · 3€/día · CPC máx 0,05€ · ${FINAL_URL}`)
  try {
    const res = await customer.mutateResources(operations, { validate_only: !APPLY })
    if (!APPLY) console.log('✅ DRY-RUN OK')
    else { console.log('✅ CREADA (ENABLED):'); (res as any).mutate_operation_responses?.forEach((r: any) => { const v = Object.values(r)[0] as any; if (v?.resource_name?.includes('/campaigns/')) console.log('   ' + v.resource_name) }) }
  } catch (e: any) { console.error('❌', e?.message || e); if (e?.errors) console.error(JSON.stringify(e.errors, null, 2)); process.exit(1) }
}
main()
