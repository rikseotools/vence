// Fix audit:epigrafe flags for administrativo_castilla_la_mancha:
// 1) expandir article_numbers NULL -> lista explícita de todos los arts de la ley
//    (la convención del repo; el auditor no cuenta filas NULL)
// 2) enriquecer epígrafes WRONG_SUBJECT para nombrar la ley que los rige
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PT = 'administrativo_castilla_la_mancha';

// enriquecimiento de epígrafe por nº de tema (añade la ley rectora)
const ENRICH = {
  6: ' Texto Refundido del Estatuto Básico del Empleado Público (RDL 5/2015) y Ley 4/2011 de Empleo Público de Castilla-La Mancha.',
  11:' Ley 40/2015, de Régimen Jurídico del Sector Público.',
  13:' Ley 40/2015, de Régimen Jurídico del Sector Público.',
  14:' Ley 40/2015, de Régimen Jurídico del Sector Público.',
  16:' Ley 39/2015 del Procedimiento Administrativo Común y Ley 29/1998 reguladora de la Jurisdicción Contencioso-administrativa.',
  17:' Ley 40/2015, de Régimen Jurídico del Sector Público.',
  19:' Ley 9/2017 de Contratos del Sector Público.',
  21:' Texto Refundido del Estatuto Básico del Empleado Público (RDL 5/2015).',
  22:' Texto Refundido del Estatuto Básico del Empleado Público (RDL 5/2015).',
  23:' Texto Refundido de la Ley del Estatuto de los Trabajadores (RDL 2/2015).',
  28:' Ley 38/2003, General de Subvenciones.',
};

(async () => {
  const { data: topics } = await s.from('topics').select('id,topic_number,epigrafe,description').eq('position_type',PT).order('topic_number');
  const byNum = {}; topics.forEach(t=>byNum[t.topic_number]=t);

  // 1) expandir NULL
  const { data: scope } = await s.from('topic_scope').select('id,topic_id,law_id,article_numbers').in('topic_id', topics.map(t=>t.id));
  const nullRows = scope.filter(r=>r.article_numbers===null);
  const lawArtCache = {};
  let expanded=0;
  for(const r of nullRows){
    if(!lawArtCache[r.law_id]){
      const { data: arts } = await s.from('articles').select('article_number').eq('law_id', r.law_id);
      lawArtCache[r.law_id] = [...new Set((arts||[]).map(a=>a.article_number).filter(Boolean))];
    }
    const list = lawArtCache[r.law_id];
    if(list.length===0){ console.log('⚠️ ley sin artículos en BD, dejo NULL:', r.law_id); continue; }
    const up = await s.from('topic_scope').update({article_numbers:list}).eq('id', r.id);
    if(up.error){ console.log('❌ expand', r.id, up.error.message); } else expanded++;
  }
  console.log('✅ filas NULL expandidas:', expanded, '/', nullRows.length);

  // 2) enriquecer epígrafes
  let enr=0;
  for(const [num, suffix] of Object.entries(ENRICH)){
    const t = byNum[num]; if(!t){ console.log('⚠️ no topic', num); continue; }
    if((t.epigrafe||'').includes(suffix.trim())){ continue; }
    const newEpi = (t.epigrafe||'').trimEnd() + suffix;
    const up = await s.from('topics').update({ epigrafe:newEpi }).eq('id', t.id);
    if(up.error){ console.log('❌ enrich T'+num, up.error.message); } else enr++;
  }
  console.log('✅ epígrafes enriquecidos:', enr);
})().catch(e=>{console.log('ABORT', e.message);process.exit(1);});
