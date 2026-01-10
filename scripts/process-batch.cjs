// Script para procesar lotes de preguntas del Bloque IV
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOPICS = {
  T401: '215832ab-af38-4b9d-8e5e-ca3a745b4ab8',
  T402: '99946758-7fb5-4ed1-b3b5-99090e2580e7',
  T403: 'e56b2d29-1c27-4749-a16e-a6253147a98e',
  T404: '78ab5fd4-a57f-43db-9592-48b2730878a9',
  T405: 'aea9bac3-c489-4144-a9d9-487052beb3d9',
  T406: '523811be-b247-48b2-a7bb-d5061ecddba7',
  T407: '8abfe801-9932-4165-8bdc-81b15a5a038e',
  T408: '096a87d7-35b4-4744-98e8-488ed8cf69a2',
  T409: '1b98a38f-087a-4516-9b3f-4423d6d00758'
};

async function getTopicQuestions(topicId, limit = 100) {
  // 1. Obtener scope del tema
  const { data: topicScopes } = await supabase
    .from('topic_scope')
    .select('article_numbers, laws(id, short_name, name)')
    .eq('topic_id', topicId);

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

  if (allArticleIds.length === 0) return [];

  // 3. Obtener preguntas pendientes
  const { data: questions } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id')
    .in('primary_article_id', allArticleIds)
    .is('topic_review_status', null)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(limit);

  return questions || [];
}

async function getArticle(articleId) {
  const { data: article } = await supabase
    .from('articles')
    .select('id, article_number, title, content, law_id, laws(short_name, name)')
    .eq('id', articleId)
    .single();
  return article;
}

async function saveVerification(questionId, articleId, lawId, status, analysis) {
  const articleOk = status === 'perfect' || status === 'bad_answer';
  const answerOk = status === 'perfect' || status === 'wrong_article';
  const explanationOk = true;

  const { error: verError } = await supabase.from('ai_verification_results').upsert({
    question_id: questionId,
    article_id: articleId,
    law_id: lawId,
    article_ok: articleOk,
    answer_ok: answerOk,
    explanation_ok: explanationOk,
    explanation: analysis,
    ai_provider: 'claude_code',
    ai_model: 'claude-opus-4-5'
  }, { onConflict: 'question_id,ai_provider' });

  if (verError) {
    console.error('Error guardando verificacion:', verError);
    return false;
  }

  const { error: updateError } = await supabase.from('questions')
    .update({ topic_review_status: status })
    .eq('id', questionId);

  if (updateError) {
    console.error('Error actualizando pregunta:', updateError);
    return false;
  }

  return true;
}

// Procesar un batch de resultados
// Formato: array de { questionId, status, analysis }
async function processBatch(results) {
  let success = 0;
  let failed = 0;

  for (const r of results) {
    // Obtener pregunta para obtener article_id y law_id
    const { data: q } = await supabase
      .from('questions')
      .select('primary_article_id')
      .eq('id', r.questionId)
      .single();

    if (!q) {
      console.error('Pregunta no encontrada:', r.questionId);
      failed++;
      continue;
    }

    const { data: article } = await supabase
      .from('articles')
      .select('id, law_id')
      .eq('id', q.primary_article_id)
      .single();

    if (!article) {
      console.error('Articulo no encontrado para pregunta:', r.questionId);
      failed++;
      continue;
    }

    const saved = await saveVerification(
      r.questionId,
      article.id,
      article.law_id,
      r.status,
      r.analysis
    );

    if (saved) {
      success++;
    } else {
      failed++;
    }
  }

  console.log(`Procesados: ${success} exito, ${failed} fallidos`);
  return { success, failed };
}

module.exports = { getTopicQuestions, getArticle, saveVerification, processBatch, TOPICS, supabase };
