const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const ids = [
  '48220ece-83ca-43ff-9a1a-dd8c71508af1',
  '3544de4e-e0c0-4f8f-8b27-44651842729e',
  'e6a7a259-c98b-454e-8b7b-faa11ed61006',
  '0c9755d6-4792-4b28-8e56-db60d967f9d4'
];

(async () => {
  let num = 0;
  for (const id of ids) {
    num++;
    const { data: q } = await s.from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (q === null) continue;

    const { data: art } = await s.from('articles')
      .select('article_number, content, law_id')
      .eq('id', q.primary_article_id)
      .single();

    let lawName = 'N/A';
    if (art && art.law_id) {
      const { data: law } = await s.from('laws').select('short_name').eq('id', art.law_id).single();
      lawName = law ? law.short_name : 'N/A';
    }

    const { data: ver } = await s.from('ai_verification_results')
      .select('*')
      .eq('question_id', id);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('PREGUNTA ' + num + '/4 - ' + q.topic_review_status);
    console.log('ID:', id.substring(0,8));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Pregunta:', q.question_text);
    console.log('');
    console.log('A)', q.option_a);
    console.log('B)', q.option_b);
    console.log('C)', q.option_c);
    console.log('D)', q.option_d);
    console.log('');
    console.log('Correcta:', ['A','B','C','D'][q.correct_option]);
    console.log('Artículo:', art ? art.article_number : 'N/A', '-', lawName);
    console.log('');
    console.log('Explicación:', (q.explanation || '').substring(0, 200));

    if (ver && ver.length > 0) {
      const v = ver[0];
      console.log('');
      console.log('--- IA ---');
      console.log('article_ok:', v.article_ok, '| answer_ok:', v.answer_ok, '| explanation_ok:', v.explanation_ok);
      console.log('Comentario:', (v.explanation || '').substring(0, 300));
    }
    console.log('');
  }
})();
