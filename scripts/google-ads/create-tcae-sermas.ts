// scripts/google-ads/create-tcae-sermas.ts
//
// Crea la campaña "C2 TCAE Servicio Madrileño de Salud" siguiendo el runbook
// google-ads-analisis.md §"Crear campaña nueva" y la plantilla create-tcae-sas.ts.
//
// CONTEXTO: TCAE SERMAS, 1.747 plazas. Producto YA completo (30/30 temas con banco;
//   el flag disponible estaba mal y se corrigió 10/06/2026). Sin campaña previa.
//   Examen previsto 2º semestre 2026 (sin fecha oficial en BOCM aún) → captación
//   forward de pago + orgánico. Presupuesto autorregulado (Maximizar clics + 3€/día
//   + CPC máx 0,05€). --apply crea ENABLED.
//
//   npx tsx --env-file=.env.local scripts/google-ads/create-tcae-sermas.ts          # dry-run
//   npx tsx --env-file=.env.local scripts/google-ads/create-tcae-sermas.ts --apply  # CREA (ENABLED)

import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'

const APPLY = process.argv.includes('--apply')
const START_ENABLED = true

const GEO_MADRID = 'geoTargetConstants/20282' // Community of Madrid (Autonomous Community)
const LANG_ES = 'languageConstants/1003'
const FINAL_URL = 'https://www.vence.es/tcae-sermas-madrid'

const HEADLINES = [
  'TCAE SERMAS Madrid',           // 18
  '1.747 plazas TCAE',            // 17
  'Temario oficial y tests',      // 23
  'Oposición TCAE Madrid',        // 21
  'Tests tipo examen TCAE',       // 22
  'Auxiliar Enfermería SERMAS',   // 26
  'Empieza gratis',               // 14
]
const DESCRIPTIONS = [
  '1.747 plazas de TCAE del Servicio Madrileño de Salud. Practica con el temario oficial.', // 86
  'Tests por tema y simulacros del examen. Mide tu progreso y empieza gratis.',             // 73
  'Temario oficial del SERMAS con preguntas comentadas. Practica desde hoy.',               // 72
]
const KEYWORDS = [
  'tcae sermas',
  'tcae madrid',
  'auxiliar enfermeria sermas',
  'oposicion tcae servicio madrileño de salud',
  'tecnico cuidados auxiliares enfermeria madrid',
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
    { entity: 'campaign_budget', operation: 'create', resource: { resource_name: R('campaignBudgets', -1), name: 'C2 TCAE Servicio Madrileño de Salud - budget', amount_micros: 3_000_000, delivery_method: 'STANDARD', explicitly_shared: false } },
    { entity: 'campaign', operation: 'create', resource: { resource_name: R('campaigns', -2), name: 'C2 TCAE Servicio Madrileño de Salud', status: campaignStatus, advertising_channel_type: 'SEARCH', campaign_budget: R('campaignBudgets', -1), target_spend: { cpc_bid_ceiling_micros: 50_000 }, network_settings: { target_google_search: true, target_search_network: false, target_content_network: false, target_partner_search_network: false }, contains_eu_political_advertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING' } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), location: { geo_target_constant: GEO_MADRID } } },
    { entity: 'campaign_criterion', operation: 'create', resource: { campaign: R('campaigns', -2), language: { language_constant: LANG_ES } } },
    { entity: 'ad_group', operation: 'create', resource: { resource_name: R('adGroups', -3), name: 'C2 TCAE SERMAS - grupo', campaign: R('campaigns', -2), type: 'SEARCH_STANDARD', status: 'ENABLED' } },
    { entity: 'ad_group_ad', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', ad: { final_urls: [FINAL_URL], responsive_search_ad: { headlines: HEADLINES.map((text) => ({ text })), descriptions: DESCRIPTIONS.map((text) => ({ text })) } } } },
    ...KEYWORDS.map((text) => ({ entity: 'ad_group_criterion', operation: 'create', resource: { ad_group: R('adGroups', -3), status: 'ENABLED', keyword: { text, match_type: 'PHRASE' } } })),
  ]

  console.log(`Modo: ${APPLY ? '🔴 APPLY (gasto real)' : '🔍 DRY-RUN (validate_only)'}`)
  console.log(`Estado campaña: ${campaignStatus}`)
  console.log(`Operaciones: ${operations.length} | geo: Madrid (20282) | 3€/día | CPC máx 0,05€`)
  try {
    const res = await customer.mutateResources(operations, { validate_only: !APPLY })
    if (!APPLY) console.log('\n✅ DRY-RUN OK — Google validó la campaña. Nada creado.')
    else { console.log('\n✅ CREADA:'); (res as any).mutate_operation_responses?.forEach((r: any) => { const v = Object.values(r)[0] as any; if (v?.resource_name) console.log('   ' + v.resource_name) }) }
  } catch (e: any) { console.error('\n❌ ERROR:', e?.message || e); if (e?.errors) console.error(JSON.stringify(e.errors, null, 2)); process.exit(1) }
}

main()
