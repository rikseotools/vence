const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: topic } = await s.from('topics')
    .select('id')
    .eq('position_type', 'administrativo')
    .eq('topic_number', 9)
    .single();

  const { data: scopes } = await s.from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', topic.id);

  let articleIds = [];
  for (const scope of (scopes || [])) {
    if (!scope.law_id || !scope.article_numbers?.length) continue;
    const { data: articles } = await s.from('articles')
      .select('id')
      .eq('law_id', scope.law_id)
      .in('article_number', scope.article_numbers);
    if (articles) articleIds.push(...articles.map(a => a.id));
  }

  const { data: questions } = await s.from('questions')
    .select('id, topic_review_status')
    .in('primary_article_id', articleIds)
    .eq('is_active', true)
    .neq('topic_review_status', 'perfect');

  console.log('T009 no-perfect:', questions.length);
  questions.forEach(q => console.log(q.id, '-', q.topic_review_status));
})();
