// scripts/google-ads/create-correos.ts
//
// Campaña Search (Maximizar clics · CPC máx 0,05€ · 3€/día) para Oposiciones de
// Correos (Personal Operativo). Mismo "modelo de las exitosas" del runbook.
// CONTEXTO: Correos es nacional → geo España (2724). Convocatoria 2026 prevista
//   (+4.000 plazas, bases 1er semestre 2026) → lead-capture; demanda altísima y
//   constante todo el año. 12 temas, examen test 100 preguntas.
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-correos.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-correos.ts --apply    # CREA (ENABLED)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
const GEO_ESPANA = 'geoTargetConstants/2724' // Spain (country)
const LANG_ES = 'languageConstants/1003'
const FINAL_URL = 'https://www.vence.es/correos-personal-operativo'

const HEADLINES: string[] = [
  'Oposiciones Correos 2026',   // 25
  '+4.000 plazas en Correos',   // 25
  'Tests del temario oficial',  // 26
  'Solo necesitas la ESO',      // 22
  'Empieza gratis',             // 14
  'Reparto, oficinas y más',    // 24
  'Practica con tests reales',  // 26
]
const DESCRIPTIONS: string[] = [
  'Prepara las oposiciones de Correos 2026 (+4.000 plazas). Tests gratis del temario.',     // 83
  'Examen tipo test de 100 preguntas. Practica los 12 temas de Correos. Empieza gratis.',    // 85
  'Reparto, atención al cliente y clasificación. Tests tipo examen de Correos, gratis.',     // 84
]
const KEYWORDS: string[] = [
  'oposiciones correos',
  'oposicion correos',
  'examen correos',
  'tests correos',
  'temario correos',
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
    { entity: 'campaign_budget', operation: 'create', resource: { resource_name: R('campaignBudgets', -1), name: 'C2 Correos Personal Operativo - budget', amount_micros: 3_000_000, delivery_method: 'STANDARD', explicitly_shared: false } },
    { entity: 'campaign', operation: 'create', resource: { resource_name: R('campaigns', -2), name: 'C2 Correos Personal Operativo', status, advertising_channel_type: 'SEARCH', campaign_budget: R('campaignBudgets', -1), target_spend: { cpc_bid_ceiling_micros: 50_000 }, network_settings: { target_google_search: true, target_search_network: false, target_content_network: false, target_partner_search_network: false }, contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), location: { geo_target_constant: GEO_ESPANA } } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), language: { language_constant: LANG_ES } } },
    { entity: 'ad_group', operation: 'create', resource: { resource_name: R('adGroups', -3), name: 'C2 Correos - grupo', campaign: R('campaigns', -2), type: 'SEARCH_STANDARD', status: 'ENABLED' } },
    { entity: 'ad_group_ad', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', ad: { final_urls: [FINAL_URL], responsive_search_ad: { headlines: HEADLINES.map((text: string) => ({ text })), descriptions: DESCRIPTIONS.map((text: string) => ({ text })) } } } },
    ...KEYWORDS.map((text: string) => ({ entity: 'ad_group_criterion', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', keyword: { text, match_type: 'PHRASE' } } })),
  ]
  console.log(`Modo: ${APPLY ? '🔴 APPLY (ENABLED)' : '🔍 DRY-RUN'} · geo España · 3€/día · CPC máx 0,05€`)
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
