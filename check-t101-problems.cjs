const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const ids = [
  '15707043-3a11-4b35-8d5b-1af1b986ab03',
  '056ae265-9271-4758-bc53-9d806d35afd3',
  '85723e71-780d-4f3b-82cf-6de66b8ab4a7',
  '35db806b-2efb-42f5-bbb5-a9da60e5faff',
  '7a0a0cfc-f2a5-4056-9271-cd1276fb4288',
  '4ec5f935-ef86-421c-8fd1-636d43a96d7d'
];

(async () => {
  for (const id of ids) {
    const { data: q } = await s
      .from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, topic_review_status, primary_article_id')
      .eq('id', id)
      .single();

    if (q === null) continue;

    const { data: art } = await s
      .from('articles')
      .select('article_number, law_id')
      .eq('id', q.primary_article_id)
      .single();

    let lawName = 'N/A';
    if (art && art.law_id) {
      const { data: law } = await s.from('laws').select('short_name').eq('id', art.law_id).single();
      lawName = law ? law.short_name : 'N/A';
    }

    console.log('----------------------------------------');
    console.log('ID:', q.id.substring(0,8));
    console.log('Estado:', q.topic_review_status);
    console.log('Articulo:', (art ? art.article_number : 'N/A') + ' - ' + lawName);
    console.log('Pregunta:', (q.question_text || '').substring(0,120) + '...');
    console.log('Correcta:', ['A','B','C','D'][q.correct_option-1]);
  }
})();
