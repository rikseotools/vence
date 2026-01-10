const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: topic } = await s.from('topics').select('id').eq('position_type', 'administrativo').eq('topic_number', 303).single();
  const { data: scopes } = await s.from('topic_scope').select('law_id, article_numbers').eq('topic_id', topic.id);
  let articleIds = [];
  for (const scope of (scopes || [])) {
    if (!scope.law_id || !scope.article_numbers?.length) continue;
    const { data: articles } = await s.from('articles').select('id').eq('law_id', scope.law_id).in('article_number', scope.article_numbers);
    if (articles) articleIds.push(...articles.map(a => a.id));
  }
  const { data: questions } = await s.from('questions')
    .select('id, topic_review_status')
    .in('primary_article_id', articleIds)
    .eq('is_active', true)
    .neq('topic_review_status', 'perfect');
  const problems = questions.filter(q => q.topic_review_status && q.topic_review_status !== 'pending');

  // Count answer_ok = true questions (likely false positives)
  let correctQs = [];
  let realProblems = [];

  for (const p of problems) {
    const { data: ver } = await s.from('ai_verification_results').select('answer_ok, article_ok, explanation_ok').eq('question_id', p.id).single();
    if (ver && ver.answer_ok === true && ver.explanation_ok === true) {
      correctQs.push(p.id);
    } else {
      realProblems.push({ id: p.id, status: p.topic_review_status, ver });
    }
  }

  console.log('Total problemas:', problems.length);
  console.log('Probables falsos positivos (answer_ok=true, explanation_ok=true):', correctQs.length);
  console.log('Problemas reales potenciales:', realProblems.length);

  // Show real problems summary
  console.log('\nProblemas reales:');
  for (const rp of realProblems.slice(0, 20)) {
    console.log(rp.id.substring(0, 8), rp.status, rp.ver ? `a:${rp.ver.answer_ok} e:${rp.ver.explanation_ok}` : 'no-ver');
  }

  // Output correct IDs for batch fix
  console.log('\n// IDs para corregir como perfect:');
  console.log('const correctIds = [');
  correctQs.slice(0, 50).forEach(id => console.log(`  '${id}',`));
  console.log('];');
})();
