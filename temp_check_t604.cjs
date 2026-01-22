require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const topicId = 'c42058be-bf18-4a83-8b40-56fa6358aa41';

  // 1. Obtener los topic_scope del tema
  const { data: topicScopes, error: scopeError } = await supabase
    .from('topic_scope')
    .select('id, article_numbers, law_id')
    .eq('topic_id', topicId);

  if (scopeError) {
    console.error('❌ Error obteniendo topic_scope:', scopeError);
    return;
  }

  console.log(`📋 Topic scopes encontrados: ${topicScopes.length}\n`);

  // 2. Obtener artículos por cada scope
  let allArticleIds = [];
  for (const scope of topicScopes || []) {
    if (!scope.law_id || !scope.article_numbers?.length) continue;

    const { data: articles } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', scope.law_id)
      .in('article_number', scope.article_numbers);

    if (articles) {
      allArticleIds.push(...articles.map(a => a.id));
    }
  }

  console.log(`📚 Artículos encontrados: ${allArticleIds.length}\n`);

  // 3. Obtener preguntas vinculadas a esos artículos
  const { data: questions, error: qError } = await supabase
    .from('questions')
    .select('id, question_text, topic_review_status, is_active')
    .in('primary_article_id', allArticleIds)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (qError) {
    console.error('❌ Error obteniendo preguntas:', qError);
    return;
  }

  console.log(`📊 Total de preguntas activas: ${questions.length}\n`);

  // Agrupar por estado
  const byStatus = {};
  questions.forEach(q => {
    const status = q.topic_review_status || 'pending';
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(q);
  });

  // Mostrar resumen
  console.log('📈 Resumen por estado:');
  Object.entries(byStatus).forEach(([status, qs]) => {
    console.log(`  ${status}: ${qs.length}`);
  });

  console.log('');

  // Mostrar preguntas con errores (NO perfect ni tech_perfect)
  const withErrors = questions.filter(q =>
    !q.topic_review_status ||
    !['perfect', 'tech_perfect'].includes(q.topic_review_status)
  );

  console.log(`🔍 Preguntas con errores o pendientes: ${withErrors.length}\n`);

  withErrors.slice(0, 20).forEach((q, idx) => {
    const preview = q.question_text.substring(0, 80).replace(/\n/g, ' ');
    console.log(`${idx + 1}. [${q.topic_review_status || 'pending'}] ${q.id}`);
    console.log(`   ${preview}...\n`);
  });

  if (withErrors.length > 20) {
    console.log(`... y ${withErrors.length - 20} más`);
  }
})();
