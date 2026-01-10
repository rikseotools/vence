const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const ids = [
  '4bcf6dfc-dc41-4c42-808e-145e82ef9edf',
  'd61b22dd-b7b3-4dae-8092-c50901951f71',
  '84c38902-4b89-485a-8023-be218aa2bcf9',
  'a43510b0-d723-482f-bd0a-1b8b2fbb441c',
  '1c915958-0aea-4043-b0ad-f98548502419',
  'c7a00b14-f291-44d3-9410-dff5cee70078'
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
    console.log('PREGUNTA ' + num + '/6 - ' + q.topic_review_status);
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
