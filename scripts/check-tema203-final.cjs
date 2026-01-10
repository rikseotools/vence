const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = '4a2dd652-dae3-470b-ba38-a5130bcd3431';

(async () => {
  const { data: scopes } = await supabase
    .from('topic_scope')
    .select('law_id')
    .eq('topic_id', TOPIC_ID);

  const lawIds = scopes ? scopes.map(s => s.law_id).filter(Boolean) : [];

  const { data: articles } = await supabase
    .from('articles')
    .select('id')
    .in('law_id', lawIds);

  const articleIds = articles ? articles.map(a => a.id) : [];

  const { data: questions } = await supabase
    .from('questions')
    .select('id, topic_review_status, verified_at')
    .in('primary_article_id', articleIds)
    .eq('is_active', true);

  console.log('=== TEMA 203 - ESTADO FINAL ===');
  console.log('Total preguntas:', questions ? questions.length : 0);

  const byStatus = {};
  if (questions) {
    questions.forEach(q => {
      const status = q.topic_review_status || 'pending';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
  }

  console.log('\nPor estado:');
  Object.entries(byStatus).sort((a,b) => b[1] - a[1]).forEach(([s, c]) => {
    console.log('  ' + s + ':', c);
  });

  // Problemas
  const problems = questions ? questions.filter(q => {
    const s = q.topic_review_status;
    return s && s !== 'perfect' && s !== 'tech_perfect' && s !== 'pending';
  }) : [];

  if (problems.length > 0) {
    console.log('\nPreguntas con problemas:');
    problems.forEach(q => {
      console.log('  ' + q.id.substring(0,8) + ' -> ' + q.topic_review_status);
    });
  }
})();
