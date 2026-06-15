// scripts/google-ads/create-ayto-madrid.ts
// Campaña "C2 Aux Admin Ayuntamiento de Madrid" (runbook google-ads-analisis §Crear campaña).
// OEP 2025 (111 plz turno libre, pendiente de convocatoria → recorrido largo, vendible).
// Maximizar clics + 3€/día + CPC máx 0,05€. geo Community of Madrid. --apply crea ENABLED.
//   npx tsx --env-file=.env.local scripts/google-ads/create-ayto-madrid.ts [--apply]
import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'
const APPLY = process.argv.includes('--apply')
const GEO = 'geoTargetConstants/20282' // Community of Madrid
const LANG_ES = 'languageConstants/1003'
const FINAL_URL = 'https://www.vence.es/auxiliar-administrativo-ayuntamiento-madrid'
const HEADLINES = [
  'Aux. Admin. Ayto. Madrid',     // 24
  '111 plazas Ayto. Madrid',      // 23
  'Temario oficial y tests',      // 23
  'Oposición Ayuntamiento Madrid',// 29
  'Tests por tema y simulacros',  // 27
  'Ayuntamiento de Madrid 2026',  // 27
  'Empieza gratis',               // 14
]
const DESCRIPTIONS = [
  'Auxiliar Administrativo Ayuntamiento de Madrid: 111 plazas OEP 2025. Temario y tests.', // 85
  'Tests por tema y simulacros del examen. Mide tu progreso y empieza gratis.',            // 73
  '22 temas del programa oficial con preguntas comentadas. Practica desde hoy.',           // 75
]
const KEYWORDS = [
  'auxiliar administrativo ayuntamiento madrid',
  'oposicion auxiliar administrativo ayuntamiento madrid',
  'oposiciones ayuntamiento de madrid',
  'auxiliar administrativo ayto madrid',
  'administrativo ayuntamiento madrid',
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
    {entity:'campaign_budget',operation:'create',resource:{resource_name:R('campaignBudgets',-1),name:'C2 Aux Admin Ayuntamiento de Madrid - budget',amount_micros:3_000_000,delivery_method:'STANDARD',explicitly_shared:false}},
    {entity:'campaign',operation:'create',resource:{resource_name:R('campaigns',-2),name:'C2 Aux Admin Ayuntamiento de Madrid',status,advertising_channel_type:'SEARCH',campaign_budget:R('campaignBudgets',-1),target_spend:{cpc_bid_ceiling_micros:50_000},network_settings:{target_google_search:true,target_search_network:false,target_content_network:false,target_partner_search_network:false},contains_eu_political_advertising:'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'}},
    {entity:'campaign_criterion',operation:'create',resource:{campaign:R('campaigns',-2),location:{geo_target_constant:GEO}}},
    {entity:'campaign_criterion',operation:'create',resource:{campaign:R('campaigns',-2),language:{language_constant:LANG_ES}}},
    {entity:'ad_group',operation:'create',resource:{resource_name:R('adGroups',-3),name:'C2 Aux Admin Ayto Madrid - grupo',campaign:R('campaigns',-2),type:'SEARCH_STANDARD',status:'ENABLED'}},
    {entity:'ad_group_ad',operation:'create',resource:{ad_group:R('adGroups',-3),status:'ENABLED',ad:{final_urls:[FINAL_URL],responsive_search_ad:{headlines:HEADLINES.map(text=>({text})),descriptions:DESCRIPTIONS.map(text=>({text}))}}}},
    ...KEYWORDS.map(text=>({entity:'ad_group_criterion',operation:'create',resource:{ad_group:R('adGroups',-3),status:'ENABLED',keyword:{text,match_type:'PHRASE'}}})),
  ]
  console.log(`Modo: ${APPLY?'🔴 APPLY':'🔍 DRY-RUN'} | ${ops.length} ops | geo Community of Madrid (20282) | 3€/día | CPC 0,05€`)
  try{
    const res=await customer.mutateResources(ops,{validate_only:!APPLY})
    if(!APPLY)console.log('\n✅ DRY-RUN OK')
    else{console.log('\n✅ CREADA:');(res as any).mutate_operation_responses?.forEach((r:any)=>{const v=Object.values(r)[0] as any;if(v?.resource_name)console.log('   '+v.resource_name)})}
  }catch(e:any){console.error('\n❌ ERROR:',e?.message||e);if(e?.errors)console.error(JSON.stringify(e.errors,null,2));process.exit(1)}
}
main()
