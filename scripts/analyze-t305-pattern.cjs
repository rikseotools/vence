const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const { data: topic } = await s.from('topics').select('id').eq('position_type', 'administrativo').eq('topic_number', 305).single();
  const { data: scopes } = await s.from('topic_scope').select('law_id, article_numbers').eq('topic_id', topic.id);

  let articleIds = [];
  for (const scope of (scopes || [])) {
    if (!scope.law_id || !scope.article_numbers?.length) continue;
    const { data: articles } = await s.from('articles').select('id').eq('law_id', scope.law_id).in('article_number', scope.article_numbers);
    if (articles) articleIds.push(...articles.map(a => a.id));
  }

  // Obtener preguntas con bad_answer
  const { data: questions } = await s.from('questions')
    .select('id, question_text, correct_option, option_d, topic_review_status')
    .in('primary_article_id', articleIds)
    .eq('is_active', true)
    .eq('topic_review_status', 'bad_answer');

  console.log('T305 - Preguntas bad_answer:', questions?.length || 0);

  // Verificar cuántas tienen 'todas' en option_d
  const todasPattern = questions?.filter(q =>
    q.option_d?.toLowerCase().includes('todas') && q.correct_option === 3
  ) || [];
  console.log('Con "Todas" en opción D (falsos positivos probables):', todasPattern.length);

  // También buscar preguntas que preguntan "cuál NO" o "INCORRECTA"
  const negativePattern = questions?.filter(q =>
    q.question_text?.toLowerCase().includes(' no ') ||
    q.question_text?.toLowerCase().includes('incorrecta') ||
    q.question_text?.toLowerCase().includes('falsa')
  ) || [];
  console.log('Preguntas con negación (falsos positivos probables):', negativePattern.length);

  // También wrong_article_bad_answer
  const { data: wrongArt } = await s.from('questions')
    .select('id, question_text, correct_option, topic_review_status')
    .in('primary_article_id', articleIds)
    .eq('is_active', true)
    .eq('topic_review_status', 'wrong_article_bad_answer');

  console.log('wrong_article_bad_answer:', wrongArt?.length || 0);

  // wrong_article
  const { data: wrongArt2 } = await s.from('questions')
    .select('id, question_text, correct_option, topic_review_status')
    .in('primary_article_id', articleIds)
    .eq('is_active', true)
    .eq('topic_review_status', 'wrong_article');

  console.log('wrong_article:', wrongArt2?.length || 0);
})();
