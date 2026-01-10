const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const ids = [
  'aad58c4c-2f4a-49b6-9254-456352b7776b',
  '3bb34481-54e6-41d7-b80f-84ef010d2f23',
  '51d6a1f9-7ab5-4a3c-b86e-c60d705908fc',
  '186e7099-f9ff-4652-bad9-6b9e87da7161',
  '30f2fe14-f887-424f-b592-763880d73fc4',
  '6328518d-9e72-4853-8641-8776d22d3db4',
  'a2895199-b6e8-43a0-8ffd-d855e407e97a',
  '077d6f6f-6e24-4ae4-8681-c8fa246c0825'
];

(async () => {
  let num = 0;
  for (const id of ids) {
    num++;
    const { data: q } = await s.from('questions')
      .select('*')
      .eq('id', id)
      .single();

    if (!q) continue;

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
    console.log(`PREGUNTA ${num}/8 - ${q.topic_review_status}`);
    console.log('ID:', id.substring(0,8));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Pregunta:', q.question_text);
    console.log('');
    console.log('A)', q.option_a);
    console.log('B)', q.option_b);
    console.log('C)', q.option_c);
    console.log('D)', q.option_d);
    console.log('');
    console.log('Correcta:', ['A','B','C','D'][q.correct_option]); // 0-indexed!
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
