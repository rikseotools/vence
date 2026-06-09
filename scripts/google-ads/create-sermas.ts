// scripts/google-ads/create-sermas.ts
//
// Crea la campaña "C2 Aux Admin Servicio Madrileño de Salud (SERMAS)" siguiendo el
// modelo del runbook google-ads-analisis.md §"Crear una campaña nueva" y el script
// hermano create-sms.ts (plantilla probada).
//
// CONTEXTO (lead capture): el examen de las 933 plazas (OEP 2022-2024) fue el
//    31/05/2026, pero hay pipeline futuro de Auxiliar Administrativo SERMAS pendiente
//    de convocar — OEP 2025 (640 plazas) + OEP 2026 (474, Decreto 54/2026). La campaña
//    capta leads del próximo ciclo. El presupuesto se autorregula (Maximizar clics +
//    3€/día + CPC máx 0,05€ → estas campañas gastan 0,2-0,8€/día, limitadas por ranking,
//    no por presupuesto; ver runbook §experimento). Bajo riesgo. Copy forward-looking.
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-sermas.ts            # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-sermas.ts --apply    # CREA (ENABLED)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
// Lead capture activo (OEP 2025/2026 pendientes de convocar): --apply crea ENABLED,
// igual que las campañas que funcionan (create-sms.ts). Poner a false para crear en pausa.
const START_ENABLED = true

const GEO_MADRID = 'geoTargetConstants/20282' // Community of Madrid (Autonomous Community)
const LANG_ES = 'languageConstants/1003'      // Spanish
const FINAL_URL = 'https://www.vence.es/auxiliar-administrativo-sermas'

// Titulares ≤30 car (mín 3). Forward-looking (próximo ciclo OEP 2025-2026), no el examen pasado.
const HEADLINES = [
  'Auxiliar Administrativo SERMAS',   // 30
  'OEP 2025 y 2026 del SERMAS',       // 27
  'Tests del temario oficial',        // 26
  'Empieza gratis',                   // 14
  'Prepara tu plaza en Madrid',       // 27
  'Oposición SERMAS Madrid',          // 24
  'Más de 1.000 plazas',              // 20
]
// Descripciones ≤90 car (mín 2).
const DESCRIPTIONS = [
  'Prepara el Auxiliar Administrativo del SERMAS (Madrid) para la próxima convocatoria.', // 84
  'OEP 2025-2026: más de 1.000 plazas. Practica con tests del temario oficial del SERMAS.',      // 87
  'Tests tipo examen del Servicio Madrileño de Salud. Mide tu progreso y empieza gratis hoy.',   // 89
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
