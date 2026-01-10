const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const ids = [
  '24f53ebf-d318-4b1a-b94b-c08c785db825',
  '7e8b5e67-76ee-40b5-bb21-228669a8b9cf',
  '296a07f2-3c8a-4b68-b215-65cd7df4641f',
  '462ab6b6-18ba-42d2-a785-68e0fa716990',
  '318e19c0-9e16-40e2-9f89-70f12ebbf048',
  'd3554d6f-dec3-489e-8b14-746b5a207e00',
  '5b95fcec-be88-4d94-9484-c8289c21cbed',
  '6ddb9615-e2ae-45c3-894e-9e6f14e53be2',
  '43c3651e-c0b8-4bfa-8a75-2c0bc16b721e',
  '49d97b06-af2c-4b64-8f42-99aa56a1d493',
  '6110a4e6-6c0c-4942-ad2b-19144d4814c2',
  '5230fb59-a316-4d32-a156-a1afdc145eb7',
  '37bc661f-ec78-43e6-a474-7d72461bd630',
  '6ff000d0-7eb7-4bf9-9f89-0e7149fd2fe8',
  'e7d9440c-e0fe-4ebe-b853-bf173a4c361f',
  'a6b9654e-526a-40d9-b06d-fe596de69225',
  'b16c33ba-3d45-49cd-936f-60524298bb42'
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
    console.log(`PREGUNTA ${num}/17 - ${q.topic_review_status}`);
    console.log('ID:', id.substring(0,8));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Pregunta:', q.question_text);
    console.log('');
    console.log('A)', q.option_a);
    console.log('B)', q.option_b);
    console.log('C)', q.option_c);
    console.log('D)', q.option_d);
    console.log('');
    console.log('Correcta:', ['A','B','C','D'][q.correct_option-1]);
    console.log('Artículo:', art ? art.article_number : 'N/A', '-', lawName);
    console.log('');
    console.log('Explicación:', (q.explanation || '').substring(0, 200));

    if (ver && ver.length > 0) {
      const v = ver[0];
      console.log('');
      console.log('--- IA ---');
      console.log('article_ok:', v.article_ok, '| answer_ok:', v.answer_ok, '| explanation_ok:', v.explanation_ok);
      console.log('Comentario:', (v.explanation || '').substring(0, 250));
    }
    console.log('');
  }
})();
