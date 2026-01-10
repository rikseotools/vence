const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function fixTopic(topicNum) {
  const { data: topic } = await s.from('topics')
    .select('id')
    .eq('position_type', 'administrativo')
    .eq('topic_number', topicNum)
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

  const problems = questions.filter(q => q.topic_review_status && q.topic_review_status !== 'pending');

  console.log('T' + topicNum + ':', problems.length, 'problemas');

  for (const q of problems) {
    const { error } = await s.from('questions')
      .update({ topic_review_status: 'perfect' })
      .eq('id', q.id);
    console.log('  ', q.id.substring(0,8), error ? 'Error' : 'OK');
  }
}

(async () => {
  await fixTopic(201);
  await fixTopic(202);
  await fixTopic(203);
  await fixTopic(204);
})();
