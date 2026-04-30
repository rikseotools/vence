require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const ids = JSON.parse(fs.readFileSync('t2_galicia_imported_ids.json', 'utf8'));
  const { data } = await supabase.from('questions').select(`
    id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
    articles!inner(article_number, title, content, laws!inner(short_name))
  `).in('id', ids);

  const shaped = data.map(q => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
    correct_option: q.correct_option,
    correct_letter: ['A','B','C','D'][q.correct_option],
    explanation: q.explanation,
    article_number: q.articles?.article_number,
    article_title: q.articles?.title,
    article_content: q.articles?.content,
    law_short_name: q.articles?.laws?.short_name,
  }));

  console.log('Extraídas:', shaped.length);

  const batchSize = 10;
  const nBatches = Math.ceil(shaped.length / batchSize);
  fs.rmSync('t2_galicia_batches', { recursive: true, force: true });
  fs.mkdirSync('t2_galicia_batches', { recursive: true });
  fs.rmSync('t2_galicia_results', { recursive: true, force: true });
  fs.mkdirSync('t2_galicia_results', { recursive: true });

  for (let i = 0; i < nBatches; i++) {
    const batch = shaped.slice(i * batchSize, (i + 1) * batchSize);
    fs.writeFileSync(`t2_galicia_batches/batch_${String(i+1).padStart(2,'0')}.json`, JSON.stringify(batch, null, 2));
  }
  console.log('Lotes creados:', nBatches);
})();
