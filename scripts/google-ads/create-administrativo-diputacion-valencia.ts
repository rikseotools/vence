// scripts/google-ads/create-administrativo-diputacion-valencia.ts
//
// Crea la campaña "C1 Administrativo Diputación de Valencia" siguiendo el runbook
// google-ads-analisis.md §"Crear campaña nueva" y la plantilla create-tcae-sas.ts.
//
// CONTEXTO: convocatoria 03/26 ACTIVA (BOP Valencia nº72 17/04/2026, OEP 2023-2026:
//   66 plazas, 56 TL + 10 discapacidad). Inscripción cerrada (4-15/05/2026), examen
//   pendiente → ventana de venta abierta (estudio en curso). Oposición creada desde
//   feedback de usuaria (María José). Presupuesto autorregulado (Maximizar clics +
//   3€/día + CPC máx 0,05€). --apply crea ENABLED.
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-administrativo-diputacion-valencia.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-administrativo-diputacion-valencia.ts --apply  # CREA (ENABLED)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
const START_ENABLED = true

// Province of Valencia (NO la Comunitat 21388, que abarca Alicante/Castellón = otras
// diputaciones; NI la City 1005545 = ayuntamiento). La Diputación cubre la provincia.
const GEO_VALENCIA_PROV = 'geoTargetConstants/20297'
const LANG_ES = 'languageConstants/1003' // Spanish
const FINAL_URL = 'https://www.vence.es/administrativo-diputacion-valencia'

// Titulares ≤30 car (mín 3).
const HEADLINES = [
  'Administrativo Dip. Valencia', // 28
  '66 plazas Administrativo C1',  // 27
  'Temario oficial y tests',      // 23
  'Oposición Diputación Valencia',// 29
  'Tests por tema y simulacros',  // 27
  'Diputación de Valencia 2026',  // 27
  'Empieza gratis',               // 14
]

// Descripciones ≤90 car (mín 2).
const DESCRIPTIONS = [
  '66 plazas de Administrativo C1 en la Diputación de Valencia. Temario oficial y tests.', // 85
  'Tests por tema y simulacros del examen. Mide tu progreso y empieza gratis.',            // 73
  '40 temas del programa oficial con preguntas comentadas. Practica desde hoy.',           // 75
]

// Keywords de intención, SIN marca.
const KEYWORDS = [
  'administrativo diputacion valencia',
  'oposicion administrativo diputacion valencia',
  'oposiciones diputacion de valencia',
  'administrativo c1 diputacion valencia',
  'administrativo dival',
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
  const campaignStatus = APPLY && START_ENABLED ? 'ENABLED' : 'PAUSED'

  const operations: any[] = [
    {
      entity: 'campaign_budget',
      operation: 'create',
      resource: {
        resource_name: R('campaignBudgets', -1),
        name: 'C1 Administrativo Diputación de Valencia - budget',
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
        name: 'C1 Administrativo Diputación de Valencia',
        status: campaignStatus,
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
      resource: { campaign: R('campaigns', -2), location: { geo_target_constant: GEO_VALENCIA_PROV } },
    },
    {
      entity: 'campaign_criterion',
      operation: 'create',
      resource: { campaign: R('campaigns', -2), language: { language_constant: LANG_ES } },
    },
    {
      entity: 'ad_group',
      operation: 'create',
      resource: {
        resource_name: R('adGroups', -3),
        name: 'C1 Administrativo Dip. Valencia - grupo',
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
  console.log(`Estado campaña: ${campaignStatus}`)
  console.log(`Operaciones: ${operations.length} | geo: Province of Valencia (20297) | 3€/día | CPC máx 0,05€`)
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
