// scripts/google-ads/create-administrativo-estado.ts
//
// Campaña Search PEQUEÑA (lead-capture) para el Cuerpo General Administrativo del
// Estado (C1). OEP 2026 confirmada (RD 387/2026, 2.300 plazas). Geo España (nacional).
// Presupuesto pequeño 1,5€/día (examen del ciclo 2025 ya pasó; se sube cuando salga
// la convocatoria 2026). Maximizar clics · CPC máx 0,05€.
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-administrativo-estado.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-administrativo-estado.ts --apply    # CREA (ENABLED)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
const GEO_ESPANA = 'geoTargetConstants/2724' // Spain (country)
const LANG_ES = 'languageConstants/1003'
const FINAL_URL = 'https://www.vence.es/administrativo-estado'

const HEADLINES: string[] = [
  'Administrativo del Estado',  // 25
  'OEP 2026: 2.300 plazas',     // 23
  'Tests del temario oficial',  // 26
  'Empieza gratis',             // 14
  'Oposición C1 del Estado',    // 23
  'Examen tipo test',           // 16
  'Practica con tests reales',  // 26
]
const DESCRIPTIONS: string[] = [
  'Prepara el Administrativo del Estado (C1): OEP 2026 con 2.300 plazas. Tests gratis.',     // 83
  'Examen tipo test (80+30 preguntas). Practica el temario oficial del Estado. Gratis.',     // 84
  'Cuerpo General Administrativo del Estado. Tests tipo examen y temario. Empieza gratis.',  // 87
]
const KEYWORDS: string[] = [
  'administrativo del estado',
  'oposiciones administrativo estado',
  'oposicion administrativo estado',
  'tests administrativo estado',
  'temario administrativo estado',
]

function assertLimits(): void {
  const badH = HEADLINES.filter((h: string) => h.length > 30)
  const badD = DESCRIPTIONS.filter((d: string) => d.length > 90)
  if (badH.length) throw new Error('Titulares >30: ' + JSON.stringify(badH))
  if (badD.length) throw new Error('Descripciones >90: ' + JSON.stringify(badD))
}

async function main(): Promise<void> {
  assertLimits()
  const customer = getGoogleAdsCustomer()
  const cid = loadAdsConfig().customerId
  const R = (entity: string, id: number): string => `customers/${cid}/${entity}/${id}`
  const status = APPLY ? 'ENABLED' : 'PAUSED'
  const operations: any[] = [
    { entity: 'campaign_budget', operation: 'create', resource: { resource_name: R('campaignBudgets', -1), name: 'C1 Administrativo del Estado - budget', amount_micros: 1_500_000, delivery_method: 'STANDARD', explicitly_shared: false } },
    { entity: 'campaign', operation: 'create', resource: { resource_name: R('campaigns', -2), name: 'C1 Administrativo del Estado', status, advertising_channel_type: 'SEARCH', campaign_budget: R('campaignBudgets', -1), target_spend: { cpc_bid_ceiling_micros: 50_000 }, network_settings: { target_google_search: true, target_search_network: false, target_content_network: false, target_partner_search_network: false }, contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), location: { geo_target_constant: GEO_ESPANA } } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), language: { language_constant: LANG_ES } } },
    { entity: 'ad_group', operation: 'create', resource: { resource_name: R('adGroups', -3), name: 'C1 Administrativo del Estado - grupo', campaign: R('campaigns', -2), type: 'SEARCH_STANDARD', status: 'ENABLED' } },
    { entity: 'ad_group_ad', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', ad: { final_urls: [FINAL_URL], responsive_search_ad: { headlines: HEADLINES.map((text: string) => ({ text })), descriptions: DESCRIPTIONS.map((text: string) => ({ text })) } } } },
    ...KEYWORDS.map((text: string) => ({ entity: 'ad_group_criterion', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', keyword: { text, match_type: 'PHRASE' } } })),
  ]
  console.log(`Modo: ${APPLY ? '🔴 APPLY (ENABLED)' : '🔍 DRY-RUN'} · geo España · 1,5€/día (pequeña) · CPC máx 0,05€`)
  try {
    const res = await customer.mutateResources(operations, { validate_only: !APPLY })
    if (!APPLY) {
      console.log('✅ DRY-RUN OK')
    } else {
      console.log('✅ CREADA:')
      ;(res as any).mutate_operation_responses?.forEach((r: any) => { const v: any = Object.values(r)[0]; if (v?.resource_name) console.log('   ' + v.resource_name) })
    }
  } catch (e: any) {
    console.error('❌', e?.message || e)
    if (e?.errors) console.error(JSON.stringify(e.errors, null, 2))
    process.exit(1)
  }
}
main()
