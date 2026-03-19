const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');

const TOPIC_ID = '4596812b-afc3-44e6-90ed-9d201547e5b3'; // T12 auxiliar_administrativo

const ERROR_STATUSES = [
  'bad_answer', 'bad_explanation', 'bad_article',
  'bad_answer_and_explanation', 'all_wrong', 'wrong_article',
  'needs_review', 'error'
];

async function main() {
  // 1. Get topic_scope for this topic
  const { data: scopes } = await supabase.from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', TOPIC_ID);

  console.log('Topic scope entries:', scopes.length);
  scopes.forEach(s => console.log(`  law_id: ${s.law_id}, articles: ${s.article_numbers?.length || 0}`));

  // 2. Get all articles for these laws/article_numbers
  const articleMap = new Map(); // article_id -> { law_id, article_number }
  for (const scope of scopes) {
    if (!scope.article_numbers) continue;
    for (let i = 0; i < scope.article_numbers.length; i += 50) {
      const batch = scope.article_numbers.slice(i, i + 50);
      const { data: articles } = await supabase.from('articles')
        .select('id, article_number')
        .eq('law_id', scope.law_id)
        .in('article_number', batch);
      (articles || []).forEach(a => articleMap.set(a.id, { law_id: scope.law_id, article_number: a.article_number }));
    }
  }
  console.log('Total articles in scope:', articleMap.size);

  // 3. Get error questions linked to these articles
  const artIds = [...articleMap.keys()];
  let allQuestions = [];
  for (let i = 0; i < artIds.length; i += 50) {
    const batch = artIds.slice(i, i + 50);
    const { data: qs } = await supabase.from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, topic_review_status, primary_article_id,
        articles(id, article_number, title, content, law_id,
          laws(id, short_name))
      `)
      .in('primary_article_id', batch)
      .in('topic_review_status', ERROR_STATUSES)
      .eq('is_active', true);
    allQuestions.push(...(qs || []));
  }

  console.log('Error questions found:', allQuestions.length);

  // 4. Format for review
  const formatted = allQuestions.map(q => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    correct_letter: ['A', 'B', 'C', 'D'][q.correct_option],
    explanation: q.explanation,
    status: q.topic_review_status,
    article_id: q.primary_article_id,
    article_number: q.articles?.article_number || null,
    article_content: q.articles?.content || null,
    law_short_name: q.articles?.laws?.short_name || null,
  }));

  // Status breakdown
  const statusCounts = {};
  formatted.forEach(q => { statusCounts[q.status] = (statusCounts[q.status] || 0) + 1; });
  console.log('Status breakdown:', statusCounts);

  // Law breakdown
  const lawCounts = {};
  formatted.forEach(q => { lawCounts[q.law_short_name || 'sin ley'] = (lawCounts[q.law_short_name || 'sin ley'] || 0) + 1; });
  console.log('Law breakdown:', lawCounts);

  // 5. Split into batches of ~9 for agents
  const batchSize = Math.ceil(formatted.length / 3);
  for (let i = 0; i < 3; i++) {
    const batch = formatted.slice(i * batchSize, (i + 1) * batchSize);
    const filename = `t12_errors_batch_${i + 1}.json`;
    fs.writeFileSync(filename, JSON.stringify(batch, null, 2));
    console.log(`${filename}: ${batch.length} preguntas`);
  }
}

main().catch(console.error);
