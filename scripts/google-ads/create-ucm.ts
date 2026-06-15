// scripts/google-ads/create-ucm.ts — Campaña "C2 Aux Admin Universidad Complutense" (UCM)
// OEP 2022 (53 plz turno libre, recorrido largo). Maximizar clics + 3€/día + CPC 0,05€. geo Community of Madrid.
//   npx tsx --env-file=.env.local scripts/google-ads/create-ucm.ts [--apply]
import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'
const APPLY=process.argv.includes('--apply')
const GEO='geoTargetConstants/20282', LANG='languageConstants/1003'
const URL='https://www.vence.es/auxiliar-administrativo-universidad-complutense'
const H=['Aux. Admin. UCM','53 plazas Complutense','Temario oficial y tests','Oposición UCM Madrid','Universidad Complutense 2026','Tests por tema y simulacros','Empieza gratis']
const D=['Auxiliar Administrativo de la Universidad Complutense (UCM): 53 plazas. Temario y tests.','Tests por tema y simulacros del examen. Mide tu progreso y empieza gratis.','12 temas del programa oficial con preguntas comentadas. Practica desde hoy.']
const K=['auxiliar administrativo universidad complutense','oposicion auxiliar administrativo ucm','oposiciones universidad complutense madrid','auxiliar administrativo ucm','administrativo universidad complutense']
if(H.some(h=>h.length>30))throw new Error('H>30: '+JSON.stringify(H.filter(h=>h.length>30)))
if(D.some(d=>d.length>90))throw new Error('D>90: '+JSON.stringify(D.filter(d=>d.length>90)))
async function main(){
  const c=getGoogleAdsCustomer(),cid=loadAdsConfig().customerId,R=(e,i)=>`customers/${cid}/${e}/${i}`,st=APPLY?'ENABLED':'PAUSED'
  const ops=[
    {entity:'campaign_budget',operation:'create',resource:{resource_name:R('campaignBudgets',-1),name:'C2 Aux Admin Universidad Complutense - budget',amount_micros:3_000_000,delivery_method:'STANDARD',explicitly_shared:false}},
    {entity:'campaign',operation:'create',resource:{resource_name:R('campaigns',-2),name:'C2 Aux Admin Universidad Complutense',status:st,advertising_channel_type:'SEARCH',campaign_budget:R('campaignBudgets',-1),target_spend:{cpc_bid_ceiling_micros:50_000},network_settings:{target_google_search:true,target_search_network:false,target_content_network:false,target_partner_search_network:false},contains_eu_political_advertising:'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'}},
    {entity:'campaign_criterion',operation:'create',resource:{campaign:R('campaigns',-2),location:{geo_target_constant:GEO}}},
    {entity:'campaign_criterion',operation:'create',resource:{campaign:R('campaigns',-2),language:{language_constant:LANG}}},
    {entity:'ad_group',operation:'create',resource:{resource_name:R('adGroups',-3),name:'C2 Aux Admin UCM - grupo',campaign:R('campaigns',-2),type:'SEARCH_STANDARD',status:'ENABLED'}},
    {entity:'ad_group_ad',operation:'create',resource:{ad_group:R('adGroups',-3),status:'ENABLED',ad:{final_urls:[URL],responsive_search_ad:{headlines:H.map(text=>({text})),descriptions:D.map(text=>({text}))}}}},
    ...K.map(text=>({entity:'ad_group_criterion',operation:'create',resource:{ad_group:R('adGroups',-3),status:'ENABLED',keyword:{text,match_type:'PHRASE'}}})),
  ]
  console.log(`${APPLY?'🔴 APPLY':'🔍 DRY'} | ${ops.length} ops | geo Community of Madrid | 3€/día | CPC 0,05€`)
  try{const res=await c.mutateResources(ops,{validate_only:!APPLY});if(!APPLY)console.log('✅ DRY OK');else{(res as any).mutate_operation_responses?.forEach((r:any)=>{const v=Object.values(r)[0] as any;if(v?.resource_name&&v.resource_name.includes('/campaigns/'))console.log('   '+v.resource_name)})}}catch(e:any){console.error('❌',e?.message||e);if(e?.errors)console.error(JSON.stringify(e.errors,null,2));process.exit(1)}
}
main()
