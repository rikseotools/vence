// scripts/google-ads/create-ujieres-cortes-generales.ts
// Campaña "C2 Ujieres Cortes Generales" (runbook google-ads-analisis §Crear campaña).
// Cuerpo de Ujieres de las Cortes Generales: 40 plazas (36 libre + 4 discap.), plazo de
// solicitudes abierto hasta ~13/08/2026 (lead-capture pre-examen; examen sin fecha aún).
// Maximizar clics + 2€/día (nicho) + CPC máx 0,05€. geo España (nacional, cuerpo estatal).
// --apply crea ENABLED; sin flag = DRY-RUN (validate_only, no crea nada). PAUSED sin --apply.
//   npx tsx --env-file=.env.local scripts/google-ads/create-ujieres-cortes-generales.ts [--apply]
import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'
const APPLY = process.argv.includes('--apply')
const GEO = 'geoTargetConstants/2724' // España (oposición nacional: Cortes Generales)
const LANG_ES = 'languageConstants/1003'
const FINAL_URL = 'https://www.vence.es/ujieres-cortes-generales'
const HEADLINES = [
  'Oposición Ujieres Cortes',  // 24
  '40 Plazas Ujieres 2026',    // 22
  'Ujieres Cortes Generales',  // 24
  'Temario Oficial y Tests',   // 23
  'Empieza Gratis en Vence',   // 23
  'Psicotécnico + Temario',    // 22
  'Plazas en el Congreso',     // 21
]
const DESCRIPTIONS = [
  '40 plazas en las Cortes Generales. Título de ESO. Temario oficial y tests por tema.',   // 83
  'Prepara el psicotécnico y el temario con tests actualizados. Empieza gratis en Vence.', // 85
  'Plazo de inscripción abierto. Practica con simulacros y preguntas por tema.',           // 75
]
const KEYWORDS = [
  'ujieres cortes generales',
  'oposicion ujieres',
  'oposiciones ujieres cortes generales',
  'cuerpo de ujieres',
  'ujieres congreso de los diputados',
  'ujieres senado',
]
function assertLimits(){
  const bH=HEADLINES.filter(h=>h.length>30), bD=DESCRIPTIONS.filter(d=>d.length>90)
  if(bH.length)throw new Error('Titulares >30: '+JSON.stringify(bH))
  if(bD.length)throw new Error('Descripciones >90: '+JSON.stringify(bD))
}
async function main(){
  assertLimits()
  const customer=getGoogleAdsCustomer(); const cid=loadAdsConfig().customerId
  const R=(e:string,id:number)=>`customers/${cid}/${e}/${id}`
  const status=APPLY?'ENABLED':'PAUSED'
  const ops:any[]=[
    {entity:'campaign_budget',operation:'create',resource:{resource_name:R('campaignBudgets',-1),name:'C2 Ujieres Cortes Generales - budget',amount_micros:2_000_000,delivery_method:'STANDARD',explicitly_shared:false}},
    {entity:'campaign',operation:'create',resource:{resource_name:R('campaigns',-2),name:'C2 Ujieres Cortes Generales',status,advertising_channel_type:'SEARCH',campaign_budget:R('campaignBudgets',-1),target_spend:{cpc_bid_ceiling_micros:50_000},network_settings:{target_google_search:true,target_search_network:false,target_content_network:false,target_partner_search_network:false},contains_eu_political_advertising:'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'}},
    {entity:'campaign_criterion',operation:'create',resource:{campaign:R('campaigns',-2),location:{geo_target_constant:GEO}}},
    {entity:'campaign_criterion',operation:'create',resource:{campaign:R('campaigns',-2),language:{language_constant:LANG_ES}}},
    {entity:'ad_group',operation:'create',resource:{resource_name:R('adGroups',-3),name:'C2 Ujieres Cortes Generales - grupo',campaign:R('campaigns',-2),type:'SEARCH_STANDARD',status:'ENABLED'}},
    {entity:'ad_group_ad',operation:'create',resource:{ad_group:R('adGroups',-3),status:'ENABLED',ad:{final_urls:[FINAL_URL],responsive_search_ad:{headlines:HEADLINES.map(text=>({text})),descriptions:DESCRIPTIONS.map(text=>({text}))}}}},
    ...KEYWORDS.map(text=>({entity:'ad_group_criterion',operation:'create',resource:{ad_group:R('adGroups',-3),status:'ENABLED',keyword:{text,match_type:'PHRASE'}}})),
  ]
  console.log(`Modo: ${APPLY?'🔴 APPLY':'🔍 DRY-RUN'} | ${ops.length} ops | geo España (2724) | 2€/día | CPC 0,05€ | ${KEYWORDS.length} keywords`)
  try{
    const res=await customer.mutateResources(ops,{validate_only:!APPLY})
    if(!APPLY)console.log('\n✅ DRY-RUN OK — la config es válida para Google Ads (nada creado).')
    else{console.log('\n✅ CREADA:');(res as any).mutate_operation_responses?.forEach((r:any)=>{const v=Object.values(r)[0] as any;if(v?.resource_name)console.log('   '+v.resource_name)})}
  }catch(e:any){console.error('\n❌ ERROR:',e?.message||e);if(e?.errors)console.error(JSON.stringify(e.errors,null,2));process.exit(1)}
}
main()
