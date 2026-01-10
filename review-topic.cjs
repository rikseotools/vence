const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const topicNum = parseInt(process.argv[2]) || 301;

(async () => {
  const { data: topic } = await s.from('topics')
    .select('id, title')
    .eq('position_type', 'administrativo')
    .eq('topic_number', topicNum)
    .single();

  console.log('══════════════════════════════════════════════════════════════════════════');
  console.log('TEMA', topicNum, '-', topic.title);
  console.log('══════════════════════════════════════════════════════════════════════════');

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

  const { data: questions } = await s.from('questions')
    .select('id, topic_review_status')
    .in('primary_article_id', articleIds)
    .eq('is_active', true)
    .neq('topic_review_status', 'perfect');

  const problems = questions.filter(q => q.topic_review_status && q.topic_review_status !== 'pending');
  console.log('Total problemas:', problems.length);
  console.log('');

  let num = 0;
  for (const p of problems) {
    num++;
    const { data: q } = await s.from('questions').select('*').eq('id', p.id).single();
    const { data: art } = await s.from('articles')
      .select('id, article_number, content, law_id')
      .eq('id', q.primary_article_id).single();

    let lawName = 'N/A';
    if (art && art.law_id) {
      const { data: law } = await s.from('laws').select('short_name, name').eq('id', art.law_id).single();
      lawName = law ? law.short_name : 'N/A';
    }

    const { data: ver } = await s.from('ai_verification_results').select('*').eq('question_id', q.id);

    console.log('┌─────────────────────────────────────────────────────────────────────────');
    console.log('│ PREGUNTA', num + '/' + problems.length, '-', q.topic_review_status);
    console.log('│ ID:', p.id);
    console.log('├─────────────────────────────────────────────────────────────────────────');
    console.log('│ PREGUNTA:', q.question_text);
    console.log('│');
    console.log('│ A)', q.option_a);
    console.log('│ B)', q.option_b);
    console.log('│ C)', q.option_c);
    console.log('│ D)', q.option_d);
    console.log('│');
    console.log('│ RESPUESTA MARCADA:', ['A','B','C','D'][q.correct_option]);
    console.log('├─────────────────────────────────────────────────────────────────────────');
    console.log('│ ARTÍCULO VINCULADO:', art ? art.article_number : 'N/A', '-', lawName);
    console.log('│ CONTENIDO ARTÍCULO:');
    if (art && art.content) {
      const lines = art.content.split('\n').slice(0, 15);
      lines.forEach(l => console.log('│   ' + l.substring(0, 90)));
      if (art.content.split('\n').length > 15) console.log('│   [...]');
    }
    console.log('├─────────────────────────────────────────────────────────────────────────');
    console.log('│ EXPLICACIÓN ACTUAL:');
    console.log('│  ', (q.explanation || 'Sin explicación').substring(0, 500));
    console.log('├─────────────────────────────────────────────────────────────────────────');
    if (ver && ver.length > 0) {
      const v = ver[0];
      console.log('│ DIAGNÓSTICO IA:');
      console.log('│   article_ok:', v.article_ok, '| answer_ok:', v.answer_ok, '| explanation_ok:', v.explanation_ok);
      console.log('│   Comentario:', (v.explanation || '').substring(0, 500));
    }
    console.log('└─────────────────────────────────────────────────────────────────────────');
    console.log('');
  }
})();
