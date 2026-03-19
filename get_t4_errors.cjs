const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const fs = require('fs');

const errorStates = [
  'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
  'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
  'tech_bad_answer', 'tech_bad_explanation', 'tech_bad_answer_and_explanation'
];

async function main() {
  // Get T4 topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'auxiliar_administrativo')
    .eq('topic_number', 4)
    .single();

  console.log('Topic:', topic.id, '-', topic.title);

  // Get scope (laws and articles for T4)
  const { data: scope } = await supabase
    .from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', topic.id);

  console.log('Scope entries:', scope.length);

  // Get all article IDs in scope
  let articleIds = [];
  for (const s of scope) {
    if (s.article_numbers && s.article_numbers.length > 0) {
      for (let i = 0; i < s.article_numbers.length; i += 100) {
        const batch = s.article_numbers.slice(i, i + 100);
        const { data: arts } = await supabase
          .from('articles')
          .select('id')
          .eq('law_id', s.law_id)
          .in('article_number', batch);
        articleIds.push(...(arts || []).map(a => a.id));
      }
    } else {
      // All articles for this law
      const { data: arts } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', s.law_id);
      articleIds.push(...(arts || []).map(a => a.id));
    }
  }

  console.log('Article IDs in scope:', articleIds.length);

  // Get error questions
  const allQuestions = [];
  for (let i = 0; i < articleIds.length; i += 200) {
    const batchIds = articleIds.slice(i, i + 200);
    const { data: questions } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, topic_review_status, primary_article_id,
        articles(id, article_number, title, content, law_id,
          laws(id, short_name, name))
      `)
      .eq('is_active', true)
      .in('primary_article_id', batchIds)
      .in('topic_review_status', errorStates);

    for (const q of questions || []) {
      if (!allQuestions.find(x => x.id === q.id)) {
        allQuestions.push({
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
          article_id: q.primary_article_id,
          article_number: q.articles?.article_number,
          article_title: q.articles?.title,
          article_content: q.articles?.content,
          law_id: q.articles?.law_id,
          law_short_name: q.articles?.laws?.short_name
        });
      }
    }
  }

  console.log('\nTotal errores T4:', allQuestions.length);

  // Distribution by status
  const byStatus = {};
  allQuestions.forEach(q => {
    byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1;
  });
  console.log('Por estado:', JSON.stringify(byStatus));

  // Distribution by law
  const byLaw = {};
  allQuestions.forEach(q => {
    const key = q.law_short_name || 'Sin ley';
    byLaw[key] = (byLaw[key] || 0) + 1;
  });
  console.log('Por ley:', JSON.stringify(byLaw));

  // Save
  allQuestions.sort((a, b) => (a.law_short_name || '').localeCompare(b.law_short_name || '') || (a.article_number || 0) - (b.article_number || 0));
  fs.writeFileSync('t4_errors.json', JSON.stringify(allQuestions, null, 2));
  console.log('Guardado en t4_errors.json');

  // Split into batches for review
  const batchSize = Math.ceil(allQuestions.length / 2);
  for (let i = 0; i < 2; i++) {
    const batch = allQuestions.slice(i * batchSize, (i + 1) * batchSize);
    fs.writeFileSync(`t4_batch_${i+1}.json`, JSON.stringify(batch, null, 2));
    console.log(`t4_batch_${i+1}.json: ${batch.length} preguntas`);
  }
}

main().catch(console.error);
