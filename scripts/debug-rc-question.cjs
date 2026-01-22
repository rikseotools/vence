const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  // Verificar la pregunta del Reglamento del Congreso
  const questionId = 'a105225c-1e0e-4093-b41f-ace559068087';

  const { data: question, error: qErr } = await supabase
    .from('questions')
    .select('id, question_text, primary_article_id')
    .eq('id', questionId)
    .single();

  if (qErr) {
    console.log('❌ Error fetching question:', qErr);
    return;
  }

  console.log('📋 Question:', {
    id: question.id,
    text: question.question_text?.substring(0, 80) + '...',
    primary_article_id: question.primary_article_id
  });

  if (!question.primary_article_id) {
    console.log('❌ PROBLEMA: La pregunta NO tiene primary_article_id!');
    return;
  }

  // Verificar el artículo
  const { data: article, error: aErr } = await supabase
    .from('articles')
    .select('id, article_number, law_id')
    .eq('id', question.primary_article_id)
    .single();

  if (aErr) {
    console.log('❌ Error fetching article:', aErr);
    return;
  }

  console.log('📄 Article:', article);

  // Verificar la ley
  const { data: law, error: lErr } = await supabase
    .from('laws')
    .select('id, short_name')
    .eq('id', article.law_id)
    .single();

  if (lErr) {
    console.log('❌ Error fetching law:', lErr);
    return;
  }

  console.log('📚 Law:', law);

  // Verificar el mapping en topic_scope
  const { data: scope, error: sErr } = await supabase
    .from('topic_scope')
    .select('topic_id, law_id, article_numbers')
    .eq('law_id', article.law_id);

  console.log('🗺️ Topic scope for this law:', scope);

  // Verificar si el artículo está en el array
  if (scope && scope.length > 0) {
    scope.forEach(s => {
      if (s.article_numbers && s.article_numbers.includes(article.article_number)) {
        console.log('✅ Article ' + article.article_number + ' IS in topic_scope for topic_id: ' + s.topic_id);
      }
    });
  }

  // Verificar topic_scope con join a topics
  const { data: topicWithScope, error: tsErr } = await supabase
    .from('topic_scope')
    .select('topic_id, law_id, article_numbers, topics(id, topic_number, position_type)')
    .eq('law_id', article.law_id);

  if (tsErr) {
    console.log('❌ Error fetching topic with scope:', tsErr);
  } else {
    console.log('🗺️ Topic scope with topic info:', JSON.stringify(topicWithScope, null, 2));
  }
})();
