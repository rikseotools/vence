const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Check current status of questions by topic - see which topics have non-perfect questions
  const { data: questions } = await s.from('questions')
    .select('topic_id, topic_review_status')
    .eq('is_active', true)
    .neq('topic_review_status', 'perfect');

  if (!questions || questions.length === 0) {
    console.log('Todas las preguntas están en estado perfect!');
    return;
  }

  // Count by topic
  const byTopic = {};
  questions.forEach(q => {
    byTopic[q.topic_id] = (byTopic[q.topic_id] || 0) + 1;
  });

  console.log('Temas con preguntas no-perfect:', Object.keys(byTopic).length);

  // Get topic details
  const topicIds = Object.keys(byTopic);
  const { data: topics } = await s.from('topics')
    .select('id, title, topic_number, position_type')
    .in('id', topicIds);

  topics.sort((a,b) => a.topic_number - b.topic_number);
  topics.forEach(t => {
    console.log(t.topic_number, '(' + byTopic[t.id] + ' problemas)', '-', t.title.substring(0,50));
  });
})();
