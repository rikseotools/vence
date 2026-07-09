require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const { createClient } = require('@supabase/supabase-js');
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');
const WF = '/tmp/claude-1000/-home-manuel-Documentos-github-vence/ab7731c9-92e7-4083-8aed-4aaceef7d2cb/scratchpad/wf';
const ADMIN = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
const BATCH = 'ext_c1_maxtecho_2806';
(async () => {
  const files = fs.readdirSync(WF).filter(f => f.startsWith('verd_') && f.endsWith('.json'));
  let confirmed = [];
  for (const f of files) {
    try { const arr = JSON.parse(fs.readFileSync(`${WF}/${f}`,'utf8')); for (const q of arr) if (q.confirmed && q.article_id && q.correct_index!=null && q.question_text) confirmed.push({...q, _f:f}); } catch(e){ console.error('parse', f, e.message); }
  }
  console.log('ficheros verd:', files.length, '| preguntas confirmadas:', confirmed.length);
  const norm = t => (t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim().slice(0,90);
  const seen = new Set();
  let from=0; while(true){ const {data}=await sb.from('questions').select('question_text').range(from,from+999); if(!data||!data.length)break; data.forEach(r=>seen.add(norm(r.question_text))); from+=1000; if(data.length<1000)break; }
  const before = confirmed.length; const dedup=[];
  for(const q of confirmed){ const k=norm(q.question_text); if(seen.has(k))continue; seen.add(k); dedup.push(q); }
  confirmed = dedup;
  console.log('tras dedup (vs BD + entre sí):', confirmed.length, '(', before-confirmed.length, 'duplicadas/ya-existentes descartadas)');
  if (process.argv[2] !== '--apply') { console.log('DRY-RUN'); await sql.end(); return; }
  let ok=0, err=0;
  for (const q of confirmed) {
    try {
      const [art] = await sql`SELECT law_id FROM articles WHERE id=${q.article_id}`;
      if(!art){ err++; continue; }
      const [ins] = await sql`INSERT INTO questions (question_text,option_a,option_b,option_c,option_d,correct_option,explanation,primary_article_id,lifecycle_state,is_official_exam,difficulty,tags)
        VALUES (${q.question_text},${q.a},${q.b},${q.c},${q.d},${q.correct_index},${q.explanation},${q.article_id},'draft',false,'medium',${sql.array(['ia_generada',BATCH,'T'+q.tema])}) RETURNING id`;
      const [ver] = await sql`INSERT INTO ai_verification_results (question_id,article_id,law_id,is_correct,confidence,explanation,ai_provider,ai_model,verified_at,article_ok,answer_ok,explanation_ok,options_ok)
        VALUES (${ins.id},${q.article_id},${art.law_id},true,'alta','IA-generada (maximizar techo) verificada por auditor ciego independiente contra artículo vigente. Anti-tell OK.','claude_code','claude-opus-4-8',now(),true,true,true,true) RETURNING id`;
      await sql`SELECT public.transition_question_state(${ins.id}::uuid,'draft'::text,'approved'::text,'ai_verified_perfect'::text,${ADMIN}::uuid,${ver.id}::uuid,'Maximizar techo C1 Ext IA-generada verificada'::text)`;
      ok++;
    } catch(e){ console.error('❌', (q.tema||'?'), e.message.slice(0,80)); err++; }
  }
  console.log('✅ activadas:', ok, '| errores:', err);
  await sql.end();
})();
