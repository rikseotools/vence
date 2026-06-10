// scripts/google-ads/create-tcae-canarias.ts — campaña C2 TCAE Servicio Canario de Salud (runbook google-ads-analisis §Crear campaña).
// Producto listo (temas con banco), examen pendiente 2026 (sin fecha oficial). Maximizar clics · 3€/día · CPC máx 0,05€. --apply crea ENABLED.
//   npx tsx --env-file=.env.local scripts/google-ads/create-tcae-canarias.ts [--apply]
import { getGoogleAdsCustomer } from '@/lib/services/googleAds/client'
import { loadAdsConfig } from '@/lib/services/googleAds/config'
const APPLY = process.argv.includes('--apply')
const GEO = 'geoTargetConstants/20277' // Canary Islands
const LANG_ES = 'languageConstants/1003'
const FINAL_URL = 'https://www.vence.es/tcae-canarias'
const HEADLINES = ["TCAE Canarias SCS","1.390 plazas TCAE","Temario oficial y tests","Oposición TCAE Canarias","Tests tipo examen TCAE","Auxiliar Enfermería SCS","Empieza gratis"]
const DESCRIPTIONS = ["1.390 plazas de TCAE del Servicio Canario de Salud. Practica con el temario oficial.","Tests por tema y simulacros del examen. Mide tu progreso y empieza gratis.","Temario oficial del SCS con preguntas comentadas. Practica desde hoy."]
const KEYWORDS = ["tcae canarias","tcae scs","auxiliar enfermeria canarias","oposicion tcae servicio canario de salud","tecnico cuidados auxiliares enfermeria canarias"]
function assertLimits(){ const bH=HEADLINES.filter(h=>h.length>30), bD=DESCRIPTIONS.filter(d=>d.length>90); if(bH.length)throw new Error('Titulares >30: '+JSON.stringify(bH)); if(bD.length)throw new Error('Descripciones >90: '+JSON.stringify(bD)); if(HEADLINES.length<3||DESCRIPTIONS.length<2)throw new Error('RSA mínimos'); }
async function main(){ assertLimits(); const customer=getGoogleAdsCustomer(); const cid=loadAdsConfig().customerId; const R=(e: string,i: number)=>`customers/${cid}/${e}/${i}`; const st=APPLY?'ENABLED':'PAUSED';
  const ops: any[]=[
    {entity:'campaign_budget',operation:'create',resource:{resource_name:R('campaignBudgets',-1),name:'C2 TCAE Servicio Canario de Salud - budget',amount_micros:3_000_000,delivery_method:'STANDARD',explicitly_shared:false}},
    {entity:'campaign',operation:'create',resource:{resource_name:R('campaigns',-2),name:'C2 TCAE Servicio Canario de Salud',status:st,advertising_channel_type:'SEARCH',campaign_budget:R('campaignBudgets',-1),target_spend:{cpc_bid_ceiling_micros:50_000},network_settings:{target_google_search:true,target_search_network:false,target_content_network:false,target_partner_search_network:false},contains_eu_political_advertising:'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING'}},
    {entity:'campaign_criterion',operation:'create',resource:{campaign:R('campaigns',-2),location:{geo_target_constant:GEO}}},
    {entity:'campaign_criterion',operation:'create',resource:{campaign:R('campaigns',-2),language:{language_constant:LANG_ES}}},
    {entity:'ad_group',operation:'create',resource:{resource_name:R('adGroups',-3),name:'C2 TCAE Servicio Canario de Salud - grupo',campaign:R('campaigns',-2),type:'SEARCH_STANDARD',status:'ENABLED'}},
    {entity:'ad_group_ad',operation:'create',resource:{ad_group:R('adGroups',-3),status:'ENABLED',ad:{final_urls:[FINAL_URL],responsive_search_ad:{headlines:HEADLINES.map(text=>({text})),descriptions:DESCRIPTIONS.map(text=>({text}))}}}},
    ...KEYWORDS.map(text=>({entity:'ad_group_criterion',operation:'create',resource:{ad_group:R('adGroups',-3),status:'ENABLED',keyword:{text,match_type:'PHRASE'}}})),
  ];
  console.log(`Modo: ${APPLY?'🔴 APPLY':'🔍 DRY-RUN'} | geo: Canary Islands (20277) | 3€/día | CPC 0,05€ | ops ${ops.length}`);
  try{ const res=await customer.mutateResources(ops,{validate_only:!APPLY});
    if(!APPLY) console.log('✅ DRY-RUN OK — nada creado.');
    else { console.log('✅ CREADA:'); res.mutate_operation_responses?.forEach((r: any)=>{const v: any=Object.values(r)[0]; if(v?.resource_name)console.log('  '+v.resource_name);}); }
  }catch(e: any){ console.error('❌ ERROR:',e?.message||e); if(e?.errors)console.error(JSON.stringify(e.errors,null,2)); process.exit(1); }
}
main()
