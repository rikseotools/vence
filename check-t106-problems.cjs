const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const ids = [
  '28e22a3e-bbf4-44aa-a695-b8f0ec562f38',
  '3ea1bd88-bb3a-4db4-a709-201b656bc419',
  'aa2b2821-8b31-497e-8c85-61e33a106aaf',
  'fcd752e4-2f0d-4030-b8d6-a95d75873422',
  'f189635a-e26a-4cef-b887-4e4ca2470d74',
  '0597741a-ef6d-42a0-ba63-d2e9f98a1452',
  '82b80fe8-6670-4e71-8847-6fba19f133bc',
  '67f6750f-1c30-4cab-9138-e402c5ed772e'
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
    console.log('PREGUNTA ' + num + '/8 - ' + q.topic_review_status);
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
