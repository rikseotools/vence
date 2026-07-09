// Activar las 86 preguntas IA de La Rioja: ai_verification_results + transition_question_state (draft→approved)
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TAGS=['gen_estatuto_la_rioja_2026-06-18','gen_ley_4_2005_la_rioja_2026-06-18','gen_ley_3_2003_la_rioja_2026-06-18','gen_lef_2026-06-18','gen_ley_11_2013_hacienda_la_rioja_2026-06-18'];
(async () => {
  let ok=0, fail=0;
  for(const tag of TAGS){
    const { data } = await s.from('questions').select('id,primary_article_id,lifecycle_state').contains('tags',[tag]);
    // resolve law_id per question article
    for(const q of data){
      if(q.lifecycle_state!=='draft'){ continue; }
      const { data: art } = await s.from('articles').select('law_id').eq('id',q.primary_article_id).single();
      await s.from('ai_verification_results').upsert({
        question_id:q.id, article_id:q.primary_article_id, law_id:art?.law_id||null,
        article_ok:true, answer_ok:true, explanation_ok:true, confidence:'alta',
        explanation:'IA-generada (Claude Opus 4.8). Auditoría: auto-audit del generador + auditor Sonnet ciego independiente + verificación mecánica (formato/posición/longitud).',
        ai_provider:'claude_code', ai_model:'claude-opus-4-8', verified_at:new Date().toISOString(),
      }, { onConflict:'question_id,ai_provider' });
      const { error } = await s.rpc('transition_question_state', {
        p_question_id:q.id, p_expected_state:'draft', p_new_state:'approved',
        p_reason_code:'ai_verified_perfect', p_changed_by:null, p_ai_verification_id:null,
        p_notes:'Batch '+tag+' — generación IA + auditoría doble (generador + Sonnet ciego) + check mecánico',
      });
      if(error){ console.log('❌',q.id,error.message); fail++; continue; }
      await s.from('questions').update({ topic_review_status:'perfect', verification_status:'ok', verified_at:new Date().toISOString() }).eq('id',q.id);
      ok++;
    }
    console.log(tag.replace('gen_','').replace('_2026-06-18',''),'procesado');
  }
  console.log('\\n✅ aprobadas:',ok,'❌ fallos:',fail);
  // verify
  let active=0;
  for(const tag of TAGS){ const { count } = await s.from('questions').select('id',{count:'exact',head:true}).contains('tags',[tag]).eq('is_active',true); active+=count||0; }
  console.log('total is_active=true:',active);
})().catch(e=>{console.log('ABORT',e.message);process.exit(1);});
