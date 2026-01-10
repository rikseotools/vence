// Script para verificar preguntas del T401
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPIC_ID = '215832ab-af38-4b9d-8e5e-ca3a745b4ab8'; // T401

async function getPendingQuestions() {
  // 1. Obtener scope del tema (leyes y articulos)
  const { data: topicScopes } = await supabase
    .from('topic_scope')
    .select('article_numbers, laws(id, short_name, name)')
    .eq('topic_id', TOPIC_ID);

  console.log('Scopes del T401:');
  for (const scope of topicScopes || []) {
    console.log('- Ley:', scope.laws?.short_name);
    console.log('  Articulos:', scope.article_numbers?.join(', '));
  }

  // 2. Obtener articulos por cada ley
  let allArticleIds = [];
  for (const scope of topicScopes || []) {
    if (!scope.laws?.id || !scope.article_numbers?.length) continue;

    const { data: articles } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', scope.laws.id)
      .in('article_number', scope.article_numbers);

    if (articles) {
      allArticleIds.push(...articles.map(a => a.id));
    }
  }

  console.log('\nTotal articulos encontrados:', allArticleIds.length);

  // 3. Obtener preguntas pendientes
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id')
    .in('primary_article_id', allArticleIds)
    .is('topic_review_status', null)
    .eq('is_active', true)
    .limit(10);

  console.log('\nPreguntas pendientes (primeras 10):', questions?.length);
  if (questions?.length > 0) {
    console.log('\nPrimera pregunta:', JSON.stringify(questions[0], null, 2));
  }

  return questions;
}

getPendingQuestions();
