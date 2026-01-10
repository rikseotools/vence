const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const topics = [301, 302, 303, 304, 305, 306, 307];

(async () => {
  console.log('=== ESTADO FINAL BLOQUE III ===\n');

  for (const num of topics) {
    const { data: topic } = await s.from('topics').select('id, title').eq('position_type', 'administrativo').eq('topic_number', num).single();
    if (!topic) {
      console.log(`T${num}: No encontrado`);
      continue;
    }

    const { data: scopes } = await s.from('topic_scope').select('law_id, article_numbers').eq('topic_id', topic.id);

    let articleIds = [];
    for (const scope of (scopes || [])) {
      if (!scope.law_id || !scope.article_numbers?.length) continue;
      const { data: articles } = await s.from('articles').select('id').eq('law_id', scope.law_id).in('article_number', scope.article_numbers);
      if (articles) articleIds.push(...articles.map(a => a.id));
    }

    if (!articleIds.length) {
      console.log(`T${num}: Sin artículos en scope`);
      continue;
    }

    const { data: questions } = await s.from('questions')
      .select('id, topic_review_status')
      .in('primary_article_id', articleIds)
      .eq('is_active', true);

    const total = questions?.length || 0;
    const perfect = questions?.filter(q => q.topic_review_status === 'perfect').length || 0;
    const pending = questions?.filter(q => q.topic_review_status === 'pending').length || 0;
    const problems = questions?.filter(q => q.topic_review_status && q.topic_review_status !== 'perfect' && q.topic_review_status !== 'pending') || [];

    console.log(`T${num}: ${total} preguntas | ✓ ${perfect} perfect | ⏳ ${pending} pending | ❌ ${problems.length} problemas`);
  }

  console.log('\n=== FIN ===');
})();
