// Script para verificar preguntas del Bloque IV
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

async function getTopicQuestions(topicId, limit = 50) {
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

async function main() {
  const topicKey = process.argv[2] || 'T401';
  const limit = parseInt(process.argv[3]) || 50;

  const topicId = TOPICS[topicKey];
  if (!topicId) {
    console.error('Topic no valido:', topicKey);
    return;
  }

  console.log(`\n=== Obteniendo preguntas pendientes de ${topicKey} ===\n`);

  const questions = await getTopicQuestions(topicId, limit);
  console.log(`Preguntas pendientes: ${questions.length}\n`);

  // Para cada pregunta, mostrar la pregunta y el articulo
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const article = await getArticle(q.primary_article_id);

    console.log(`\n--- Pregunta ${i + 1}/${questions.length} ---`);
    console.log(`ID: ${q.id}`);
    console.log(`\nPREGUNTA: ${q.question_text}`);
    console.log(`A) ${q.option_a}`);
    console.log(`B) ${q.option_b}`);
    console.log(`C) ${q.option_c}`);
    console.log(`D) ${q.option_d}`);
    console.log(`\nRespuesta marcada: ${['A', 'B', 'C', 'D'][q.correct_option]}`);
    console.log(`\nExplicacion: ${q.explanation}`);

    if (article) {
      console.log(`\n--- Articulo vinculado ---`);
      console.log(`Ley: ${article.laws?.short_name} (${article.laws?.name})`);
      console.log(`Articulo: ${article.article_number}`);
      console.log(`Titulo: ${article.title || 'Sin titulo'}`);
      console.log(`\nContenido:`);
      console.log(article.content || 'Sin contenido');
    } else {
      console.log('\n[NO HAY ARTICULO VINCULADO]');
    }

    console.log('\n' + '='.repeat(80));
  }
}

main();
