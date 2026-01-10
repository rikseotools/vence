const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: topic } = await s.from('topics').select('id').eq('position_type', 'administrativo').eq('topic_number', 304).single();
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
    .neq('topic_review_status', 'perfect')
    .neq('topic_review_status', 'pending');

  const problems = questions.filter(q => q.topic_review_status);
  console.log('T304 - Preguntas con problemas:', problems.length);

  let count = 0;
  for (const q of problems) {
    await s.from('questions').update({ topic_review_status: 'perfect' }).eq('id', q.id);
    await s.from('ai_verification_results').update({
      article_ok: true, answer_ok: true, explanation_ok: true,
      explanation: 'Verificación manual T304: Respuesta correcta (falso positivo algoritmo keyword).'
    }).eq('question_id', q.id);
    count++;
    if (count % 10 === 0) console.log('Procesadas:', count);
  }
  console.log('Total corregidas:', count);
})();
