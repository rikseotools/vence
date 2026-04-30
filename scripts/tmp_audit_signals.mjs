import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = readFileSync('/home/manuel/Documentos/github/vence/.env.local','utf8').split('\n').reduce((a,l)=>{const m=l.match(/^([^=]+)=(.*)$/);if(m)a[m[1]]=m[2].replace(/^["']|["']$/g,'');return a;},{});
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const urls = [
  'https://www.diputaciondezamora.es/empleo',
  'https://www.diputoledo.es',
  'https://www.dipsoria.es/ofertas-empleo',
  'https://www.diputaciondeleon.es',
  'https://sede.diphuelva.es',
  'https://www.diputacadiz.es',
  'https://www.diputacionavila.es/recursos-humanos/oferta-de-empleo-publico/',
  'https://www.tenerife.es/convocatorias-de-empleo-publico-abiertas',
  'https://www.valencia.es/cas/tramites/seguimiento-de-oposiciones',
];
for (const u of urls) {
  const { data, error } = await sb.from('oep_detection_signals')
    .select('id,sensor_type,status,region_name,position_category,detected_oposicion_name,detected_year,detected_plazas_libre,detected_estado,signal_summary,raw_extraction')
    .eq('source_url', u)
    .eq('sensor_type','regional_scan')
    .order('created_at',{ascending:false});
  console.log('\n===', u, '===', data?.length||0, 'signals', error?error.message:'');
  for (const r of data||[]) {
    console.log('- id=', r.id.slice(0,8), 'status=', r.status, '| region=', r.region_name, '| cat=', r.position_category, '| name=', r.detected_oposicion_name, '| year=', r.detected_year, '| plazas=', r.detected_plazas_libre, '| estado=', r.detected_estado);
    console.log('  summary:', (r.signal_summary||'').slice(0,200));
  }
}
