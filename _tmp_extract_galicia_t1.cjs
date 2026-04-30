require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const TOPIC_ID = '5a40a4eb-cb7f-4e65-bba4-9ff8c06af99b';

(async () => {
  const { data: scope } = await supabase
    .from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', TOPIC_ID);

  const articleIds = [];
  for (const s of scope) {
    const { data: arts } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', s.law_id)
      .in('article_number', s.article_numbers);
    articleIds.push(...arts.map(a => a.id));
  }
  console.log('Artículos en scope:', articleIds.length);

  let allQuestions = [];
  let from = 0;
  const pageSize = 200;
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, topic_review_status, primary_article_id,
        articles!inner(id, article_number, title, content, law_id,
          laws!inner(id, short_name, name))
      `)
      .in('primary_article_id', articleIds)
      .eq('is_active', false)
      .eq('deactivation_reason', 'Pendiente de revisión post-importación')
      .range(from, from + pageSize - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    allQuestions.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const shaped = allQuestions.map(q => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    correct_letter: ['A','B','C','D'][q.correct_option],
    explanation: q.explanation,
    article_id: q.articles?.id,
    article_number: q.articles?.article_number,
    article_title: q.articles?.title,
    article_content: q.articles?.content,
    law_id: q.articles?.law_id,
    law_short_name: q.articles?.laws?.short_name,
  }));

  fs.writeFileSync('error_questions_galicia_t1.json', JSON.stringify(shaped, null, 2));
  console.log('Total extraídas:', shaped.length);

  // Split into batches of 15
  const batchSize = 15;
  const nBatches = Math.ceil(shaped.length / batchSize);
  fs.mkdirSync('galicia_t1_batches', { recursive: true });
  for (let i = 0; i < nBatches; i++) {
    const batch = shaped.slice(i * batchSize, (i + 1) * batchSize);
    fs.writeFileSync(`galicia_t1_batches/batch_${String(i+1).padStart(2,'0')}.json`, JSON.stringify(batch, null, 2));
  }
  console.log('Lotes creados:', nBatches);
})();
