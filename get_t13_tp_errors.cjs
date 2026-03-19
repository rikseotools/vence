require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const topicId = '52b48079-b79c-4a3f-982e-3be787f91329';

  const errorStates = [
    'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
    'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
    'tech_bad_answer', 'tech_bad_explanation', 'tech_bad_answer_and_explanation'
  ];

  // Get topic scope
  const { data: scope } = await supabase
    .from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', topicId);

  console.log('Topic scope entries:', scope?.length);

  // Get article IDs
  let articleIds = [];
  for (const s of scope || []) {
    const { data: arts } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', s.law_id)
      .in('article_number', s.article_numbers || []);
    articleIds.push(...(arts?.map(a => a.id) || []));
  }

  console.log('Total articles in scope:', articleIds.length);

  // Get error questions
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d,
      correct_option, explanation, topic_review_status, primary_article_id,
      articles!inner(id, article_number, title, content, law_id,
        laws!inner(id, short_name))
    `)
    .eq('is_active', true)
    .in('primary_article_id', articleIds)
    .in('topic_review_status', errorStates);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total error questions:', questions?.length);

  // Count by status
  const statusCounts = {};
  for (const q of questions || []) {
    statusCounts[q.topic_review_status] = (statusCounts[q.topic_review_status] || 0) + 1;
  }
  console.log('By status:', JSON.stringify(statusCounts, null, 2));

  // Format for agents
  const formatted = (questions || []).map((q, i) => ({
    index: i + 1,
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    correct_letter: ['A', 'B', 'C', 'D'][q.correct_option],
    explanation: q.explanation,
    topic_review_status: q.topic_review_status,
    article_number: q.articles?.article_number,
    article_title: q.articles?.title,
    article_content: q.articles?.content,
    law_short_name: q.articles?.laws?.short_name
  }));

  require('fs').writeFileSync('t13_tp_errors.json', JSON.stringify(formatted, null, 2));
  console.log('\nSaved to t13_tp_errors.json');
}

main().catch(console.error);
