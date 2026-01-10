const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  // Get T202 topic
  const { data: topic } = await s.from('topics')
    .select('id')
    .eq('position_type', 'administrativo')
    .eq('topic_number', 202)
    .single();

  const { data: scopes } = await s.from('topic_scope')
    .select('law_id, article_numbers')
    .eq('topic_id', topic.id);

  let articleIds = [];
  for (const scope of (scopes || [])) {
    if (!scope.law_id || !scope.article_numbers?.length) continue;
    const { data: articles } = await s.from('articles')
      .select('id')
      .eq('law_id', scope.law_id)
      .in('article_number', scope.article_numbers);
    if (articles) articleIds.push(...articles.map(a => a.id));
  }

  // Get questions with bad answer
  const { data: questions } = await s.from('questions')
    .select('id, topic_review_status')
    .in('primary_article_id', articleIds)
    .eq('is_active', true)
    .in('topic_review_status', ['bad_answer', 'bad_answer_and_explanation']);

  console.log('T202 preguntas con bad_answer:', questions.length);

  for (const p of questions) {
    const { data: q } = await s.from('questions').select('*').eq('id', p.id).single();
    const { data: art } = await s.from('articles')
      .select('article_number, law_id')
      .eq('id', q.primary_article_id).single();
    let lawName = 'N/A';
    if (art && art.law_id) {
      const { data: law } = await s.from('laws').select('short_name').eq('id', art.law_id).single();
      lawName = law ? law.short_name : 'N/A';
    }
    const { data: ver } = await s.from('ai_verification_results').select('*').eq('question_id', q.id);

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('ID:', p.id.substring(0,8), '-', q.topic_review_status);
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('Pregunta:', q.question_text.substring(0, 200));
    console.log('');
    console.log('A)', q.option_a.substring(0, 100));
    console.log('B)', q.option_b.substring(0, 100));
    console.log('C)', q.option_c.substring(0, 100));
    console.log('D)', q.option_d.substring(0, 100));
    console.log('');
    console.log('Correcta:', ['A','B','C','D'][q.correct_option]);
    console.log('Artículo:', art ? art.article_number : 'N/A', '-', lawName);

    if (ver && ver.length > 0) {
      const v = ver[0];
      console.log('');
      console.log('--- IA ---');
      console.log('Comentario:', (v.explanation || '').substring(0, 450));
    }
    console.log('');
  }
})();
