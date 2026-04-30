require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const ids = JSON.parse(fs.readFileSync('t14_galicia_imported_ids.json'));
  const { data: qs } = await s.from('questions').select(`
    id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation,
    primary_article_id,
    articles!questions_primary_article_id_fkey ( article_number, title, content, law_id, laws!articles_law_id_fkey ( short_name ) )
  `).in('id', ids);

  console.log('Questions fetched:', qs.length);

  const batchDir = '/home/manuel/Documentos/github/vence/t14_galicia_batches';
  fs.mkdirSync(batchDir, { recursive: true });

  const BATCH_SIZE = 10;
  const batches = [];
  for (let i = 0; i < qs.length; i += BATCH_SIZE) batches.push(qs.slice(i, i + BATCH_SIZE));

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i].map(q => ({
      id: q.id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      correct_letter: ['A','B','C','D'][q.correct_option],
      explanation: q.explanation,
      article_number: q.articles?.article_number,
      article_title: q.articles?.title,
      article_content: q.articles?.content,
      law_short_name: q.articles?.laws?.short_name,
    }));
    const name = 'batch_' + String(i + 1).padStart(2, '0') + '.json';
    fs.writeFileSync(`${batchDir}/${name}`, JSON.stringify(batch, null, 2));
    console.log('  ' + name + ':', batch.length, 'preguntas');
  }
  console.log('\\nTotal batches:', batches.length);

  // Create empty results dir
  fs.mkdirSync('/home/manuel/Documentos/github/vence/t14_galicia_results', { recursive: true });
})();
