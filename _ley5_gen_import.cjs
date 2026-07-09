require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');
const SP = '/tmp/claude-1000/-home-manuel-Documentos-github-vence/ab7731c9-92e7-4083-8aed-4aaceef7d2cb/scratchpad';
const BATCH = 'ext_c1_hacienda_2806';
(async () => {
  let all = [];
  for (const t of ['T26','T27','T28']) {
    const p = `${SP}/gen_${t}.json`;
    if (!fs.existsSync(p)) { console.error('FALTA', t); continue; }
    const arr = JSON.parse(fs.readFileSync(p,'utf8'));
    arr.forEach(q => all.push({ ...q, tema:t }));
  }
  console.log('generadas leídas:', all.length);
  // chequeo mecánico anti-tell: distractor balance + posición
  const dist = {0:0,1:0,2:0,3:0};
  let longestIsCorrect = 0;
  for (const q of all) {
    dist[q.correct_index]++;
    const opts = [q.a,q.b,q.c,q.d].map(x=>(x||'').length);
    const correctLen = opts[q.correct_index];
    const others = opts.filter((_,i)=>i!==q.correct_index);
    if (correctLen > 1.3*Math.max(...others)) longestIsCorrect++;
  }
  console.log('distribución correctas A/B/C/D:', JSON.stringify(dist));
  console.log('correcta es la más larga (>1.3x):', longestIsCorrect, '/', all.length, '(ideal: bajo)');
  if (process.argv[2] !== '--apply') { console.log('DRY-RUN'); return; }
  let ok=0; const inserted=[];
  for (const q of all) {
    if (!q.article_id || q.correct_index==null) { console.error('skip (incompleta)', q.tema); continue; }
    const { data, error } = await s.from('questions').insert({
      question_text:q.question_text, option_a:q.a, option_b:q.b, option_c:q.c, option_d:q.d,
      correct_option:q.correct_index, explanation:q.explanation, primary_article_id:q.article_id,
      lifecycle_state:'draft', is_official_exam:false, difficulty:'medium',
      tags:['ia_generada', BATCH, q.tema],
    }).select('id').single();
    if (error) { console.error('❌', q.tema, error.message); continue; }
    ok++; inserted.push({ qid:data.id, tema:q.tema, article_id:q.article_id, correct_index:q.correct_index });
  }
  fs.writeFileSync(`${SP}/gen_inserted.json`, JSON.stringify(inserted));
  console.log('✅ insertadas draft:', ok, '| gen_inserted.json escrito');
})();
