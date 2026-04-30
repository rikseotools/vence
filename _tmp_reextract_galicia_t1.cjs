require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = '5a40a4eb-cb7f-4e65-bba4-9ff8c06af99b';

(async () => {
  // Get all questions that were in the first pass (both active=true and the 1 inactive #17)
  const consolidated = JSON.parse(fs.readFileSync('galicia_t1_consolidated.json', 'utf8'));
  const ids = consolidated.map(r => r.id);

  let allQuestions = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, is_active, topic_review_status, primary_article_id,
        articles!inner(id, article_number, title, content, law_id,
          laws!inner(id, short_name, name))
      `)
      .in('id', chunk);
    if (error) { console.error(error); break; }
    allQuestions.push(...(data || []));
  }

  const shaped = allQuestions.map(q => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a, option_b: q.option_b,
    option_c: q.option_c, option_d: q.option_d,
    correct_option: q.correct_option,
    correct_letter: ['A','B','C','D'][q.correct_option],
    explanation: q.explanation,
    article_number: q.articles?.article_number,
    article_title: q.articles?.title,
    article_content: q.articles?.content,
    law_short_name: q.articles?.laws?.short_name,
  }));

  fs.writeFileSync('galicia_t1_recheck.json', JSON.stringify(shaped, null, 2));
  console.log('Re-extraídas:', shaped.length);

  // Split into batches of 10 → ~37 batches
  const batchSize = 10;
  const nBatches = Math.ceil(shaped.length / batchSize);
  fs.rmSync('galicia_t1_recheck_batches', { recursive: true, force: true });
  fs.mkdirSync('galicia_t1_recheck_batches', { recursive: true });
  fs.rmSync('galicia_t1_recheck_results', { recursive: true, force: true });
  fs.mkdirSync('galicia_t1_recheck_results', { recursive: true });

  for (let i = 0; i < nBatches; i++) {
    const batch = shaped.slice(i * batchSize, (i + 1) * batchSize);
    fs.writeFileSync(`galicia_t1_recheck_batches/batch_${String(i+1).padStart(2,'0')}.json`, JSON.stringify(batch, null, 2));
  }
  console.log('Lotes creados:', nBatches);
})();
