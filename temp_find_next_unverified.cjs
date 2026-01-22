require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const topicId = 'c42058be-bf18-4a83-8b40-56fa6358aa41';

  const { data: topicScopes } = await supabase
    .from('topic_scope')
    .select('id, article_numbers, law_id')
    .eq('topic_id', topicId);

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

  const { data: questions } = await supabase
    .from('questions')
    .select('id, topic_review_status')
    .in('primary_article_id', allArticleIds)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  const withErrors = questions.filter(q =>
    !q.topic_review_status ||
    !['perfect', 'tech_perfect'].includes(q.topic_review_status)
  );

  // Obtener IDs ya verificados
  const { data: verified } = await supabase
    .from('ai_verification_results')
    .select('question_id')
    .gte('created_at', '2026-01-20');

  const verifiedIds = new Set(verified?.map(v => v.question_id) || []);

  // Buscar primera no verificada
  for (let i = 0; i < withErrors.length; i++) {
    if (!verifiedIds.has(withErrors[i].id)) {
      console.log(`Pregunta ${i + 1} no verificada:`, withErrors[i].id);
      return;
    }
  }

  console.log('Todas las preguntas han sido verificadas hoy');
})();
