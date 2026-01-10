const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const topicNum = parseInt(process.argv[2]) || 304;

(async () => {
  const { data: topic } = await s.from('topics').select('id, title').eq('position_type', 'administrativo').eq('topic_number', topicNum).single();
  console.log('Tema:', topicNum, '-', topic.title);

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
  console.log('Falsos positivos (answer_ok=true):', correctQs.length);
  console.log('Problemas reales:', realProblems.length);

  // Output IDs for batch fix
  if (correctQs.length > 0) {
    console.log('\nconst correctIds = [');
    correctQs.forEach(id => console.log(`  '${id}',`));
    console.log('];');
  }
})();
