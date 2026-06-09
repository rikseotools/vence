// scripts/google-ads/create-sermas.ts
//
// Crea la campaña "C2 Aux Admin Servicio Madrileño de Salud (SERMAS)" siguiendo el
// modelo del runbook google-ads-analisis.md §"Crear una campaña nueva" y el script
// hermano create-sms.ts (plantilla probada).
//
// ⚠️ TIMING (leer antes de --apply): el examen del SERMAS fue el 31/05/2026
//    (oposiciones.estado_proceso = 'examen_realizado'). Según el TL;DR del runbook,
//    "el examen pasado seca las ventas" (pico de compra 0-30 días ANTES del examen).
//    → NO conviene activarla ahora. Dejarla PAUSED y ENABLE solo cuando se abra la
//      próxima convocatoria (vigilar seguimiento_url / OEP Madrid). El script crea
//      la campaña en PAUSED salvo --apply, y aun con --apply la deja PAUSED por
//      defecto (cambiar START_ENABLED=true solo cuando haya ventana de venta).
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-sermas.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-sermas.ts --apply    # CREA (en PAUSED)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
// Examen ya realizado (31/05/2026): crear SIEMPRE en PAUSED hasta que haya próxima
// convocatoria. Poner a true solo cuando se abra la ventana de venta.
const START_ENABLED = false

const GEO_MADRID = 'geoTargetConstants/20282' // Community of Madrid (Autonomous Community)
const LANG_ES = 'languageConstants/1003'      // Spanish
const FINAL_URL = 'https://www.vence.es/auxiliar-administrativo-sermas'

// Titulares ≤30 car (mín 3). Ganchos reales: nº de plazas, temario oficial, empieza gratis.
const HEADLINES = [
  'Auxiliar Administrativo SERMAS',   // 30
  '933 plazas en Madrid',             // 21
  'Tests del temario oficial',        // 26
  'Empieza gratis',                   // 14
  'Prepara el examen SERMAS',         // 24
  'Oposición SERMAS Madrid',          // 24
  'Practica con tests reales',        // 25
]
// Descripciones ≤90 car (mín 2).
const DESCRIPTIONS = [
  'Tests del temario oficial del Auxiliar Administrativo del SERMAS. Empieza gratis hoy.', // 85
  '933 plazas en la Comunidad de Madrid. Practica con preguntas tipo examen y progresa.',  // 85
  'Prepara la oposición del Servicio Madrileño de Salud con tests actualizados.',          // 76
]
// Keywords de intención, SIN marca.
const KEYWORDS = [
  'auxiliar administrativo sermas',
  'auxiliar administrativo servicio madrileño de salud',
  'oposicion auxiliar administrativo sermas',
  'oposiciones auxiliar administrativo madrid salud',
  'auxiliar administrativo sermas madrid',
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
        name: 'C2 Aux Admin SERMAS - budget',
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
        name: 'C2 Aux Admin Servicio Madrileño de Salud',
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
      resource: {
        campaign: R('campaigns', -2),
        location: { geo_target_constant: GEO_MADRID },
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
        name: 'C2 Aux Admin SERMAS - grupo',
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
  console.log(`Estado campaña: ${campaignStatus}${APPLY && !START_ENABLED ? ' (examen pasado → en pausa hasta próxima convocatoria)' : ''}`)
  console.log(`Operaciones: ${operations.length} | geo: Community of Madrid (20282) | 3€/día | CPC máx 0,05€`)
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
