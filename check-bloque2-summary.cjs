const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkTopic(topicNum) {
  const { data: topic } = await s.from('topics')
    .select('id, title')
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

  // Get AI verification for each
  let answerOkCount = 0;
  let answerBadCount = 0;

  for (const p of problems) {
    const { data: ver } = await s.from('ai_verification_results')
      .select('answer_ok')
      .eq('question_id', p.id)
      .single();
    if (ver && ver.answer_ok) answerOkCount++;
    else answerBadCount++;
  }

  console.log(`T${topicNum} - ${topic.title.substring(0,30)}`);
  console.log(`  Total problemas: ${problems.length}`);
  console.log(`  answer_ok: ${answerOkCount} | answer_bad: ${answerBadCount}`);

  // Show bad_answer ones
  if (answerBadCount > 0) {
    console.log('  IDs con answer_bad:');
    for (const p of problems) {
      const { data: ver } = await s.from('ai_verification_results')
        .select('answer_ok')
        .eq('question_id', p.id)
        .single();
      if (ver && !ver.answer_ok) {
        console.log('    ' + p.id.substring(0,8) + ' - ' + p.topic_review_status);
      }
    }
  }
  console.log('');
}

(async () => {
  await checkTopic(202);
  await checkTopic(203);
  await checkTopic(204);
})();
