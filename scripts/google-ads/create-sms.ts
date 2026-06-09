// scripts/google-ads/create-sms.ts
//
// Crea la campaña "C2 Aux Admin Servicio Murciano de Salud" siguiendo el modelo
// del runbook google-ads-analisis.md §"Crear una campaña nueva".
// DRY-RUN por defecto (validate_only:true). Solo aplica con --apply.
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-sms.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-sms.ts --apply    # CREA (gasto real)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')

const GEO_MURCIA = 'geoTargetConstants/20284' // Region of Murcia
const LANG_ES = 'languageConstants/1003'      // Spanish
const FINAL_URL = 'https://www.vence.es/auxiliar-administrativo-sms'

const HEADLINES = [
  'Auxiliar Administrativo SMS',
  '66 plazas turno libre',
  'Tests del temario oficial',
  'Empieza gratis',
  'Prepárate el examen SMS',
  'Oposición SMS Murcia',
  'Practica con tests reales',
]
const DESCRIPTIONS = [
  'Tests del temario oficial del Auxiliar Administrativo del SMS. Empieza gratis hoy.',
  '66 plazas turno libre. Practica con preguntas tipo examen y mide tu progreso.',
  'Prepara la oposición del Servicio Murciano de Salud con tests actualizados.',
]
const KEYWORDS = [
  'auxiliar administrativo servicio murciano de salud',
  'auxiliar administrativo sms',
  'oposicion auxiliar administrativo sms',
  'oposiciones auxiliar administrativo murcia salud',
  'auxiliar administrativo sms murcia',
]

function assertLimits() {
  const badH = HEADLINES.filter((h) => h.length > 30)
  const badD = DESCRIPTIONS.filter((d) => d.length > 90)
  if (badH.length) throw new Error('Titulares >30: ' + JSON.stringify(badH))
  if (badD.length) throw new Error('Descripciones >90: ' + JSON.stringify(badD))
  if (HEADLINES.length < 3 || DESCRIPTIONS.length < 2) throw new Error('RSA mínimos no cumplidos')
}

async function main() {
  assertLimits()
  const customer = getGoogleAdsCustomer()
  const cid = loadAdsConfig().customerId
  const R = (entity: string, id: number) => `customers/${cid}/${entity}/${id}`

  const operations: any[] = [
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: R('campaignBudgets', -1),
        name: 'C2 Aux Admin SMS - budget',
        amount_micros: 3_000_000, // 3€/día
        delivery_method: 'STANDARD',
        explicitly_shared: false,
      },
    },
    {
      entity: 'campaign',
      operation: 'create',
      resource: {
        resource_name: R('campaigns', -2),
        name: 'C2 Aux Admin Servicio Murciano de Salud',
        status: APPLY ? 'ENABLED' : 'PAUSED',
        advertising_channel_type: 'SEARCH',
        campaign_budget: R('campaignBudgets', -1),
        target_spend: { cpc_bid_ceiling_micros: 50_000 }, // Maximizar clics, CPC máx 0,05€
        network_settings: {
          target_google_search: true,
          target_search_network: false,
          target_content_network: false,
          target_partner_search_network: false,
        },
        contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING',
      },
    },
    {
      entity: 'campaign_criterion',
      operation: 'create',
      resource: {
        campaign: R('campaigns', -2),
        location: { geo_target_constant: GEO_MURCIA },
      },
    },
    {
      entity: 'campaign_criterion',
      operation: 'create',
      resource: {
        campaign: R('campaigns', -2),
        language: { language_constant: LANG_ES },
      },
    },
    {
      entity: 'ad_group',
      operation: 'create',
      resource: {
        resource_name: R('adGroups', -3),
        name: 'C2 Aux Admin SMS - grupo',
        campaign: R('campaigns', -2),
        type: 'SEARCH_STANDARD',
        status: 'ENABLED',
      },
    },
    {
      entity: 'ad_group_ad',
      operation: 'create',
      resource: {
        ad_group: R('adGroups', -3),
        status: 'ENABLED',
        ad: {
          final_urls: [FINAL_URL],
          responsive_search_ad: {
            headlines: HEADLINES.map((text) => ({ text })),
            descriptions: DESCRIPTIONS.map((text) => ({ text })),
          },
        },
      },
    },
    ...KEYWORDS.map((text) => ({
      entity: 'ad_group_criterion',
      operation: 'create',
      resource: {
        ad_group: R('adGroups', -3),
        status: 'ENABLED',
        keyword: { text, match_type: 'PHRASE' },
      },
    })),
  ]

  console.log(`Modo: ${APPLY ? '🔴 APPLY (gasto real)' : '🔍 DRY-RUN (validate_only)'}`)
  console.log(`Operaciones: ${operations.length} | geo: Murcia(20284) | 3€/día | CPC máx 0,05€`)
  try {
    const res = await customer.mutateResources(operations, { validate_only: !APPLY })
    if (!APPLY) {
      console.log('\n✅ DRY-RUN OK — Google validó la campaña. Nada creado.')
    } else {
      console.log('\n✅ CREADA:')
      ;(res as any).mutate_operation_responses?.forEach((r: any) => {
        const v = Object.values(r)[0] as any
        if (v?.resource_name) console.log('   ' + v.resource_name)
      })
    }
  } catch (e: any) {
    console.error('\n❌ ERROR:', e?.message || e)
    if (e?.errors) console.error(JSON.stringify(e.errors, null, 2))
    process.exit(1)
  }
}

main()
