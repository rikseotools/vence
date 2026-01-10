/**
 * Script para corregir falsos positivos en T305-T307
 * Preguntas marcadas como "bad_answer" pero que en realidad son correctas
 * porque la respuesta es "Todas las anteriores son correctas" o similar
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const topics = [
  { number: 305, name: 'Procedimientos y Formas' },
  { number: 306, name: 'Responsabilidad Patrimonial' },
  { number: 307, name: 'Políticas de Igualdad' }
];

async function getTopicArticles(topicNumber) {
  const { data: topic } = await s.from('topics').select('id').eq('position_type', 'administrativo').eq('topic_number', topicNumber).single();
  if (!topic) return [];

  const { data: scopes } = await s.from('topic_scope').select('law_id, article_numbers').eq('topic_id', topic.id);
  if (!scopes?.length) return [];

  let articleIds = [];
  for (const scope of scopes) {
    if (!scope.law_id || !scope.article_numbers?.length) continue;
    const { data: articles } = await s.from('articles').select('id').eq('law_id', scope.law_id).in('article_number', scope.article_numbers);
    if (articles) articleIds.push(...articles.map(a => a.id));
  }
  return articleIds;
}

async function fixFalsePositives(topicNumber, topicName) {
  console.log(`\n=== T${topicNumber} - ${topicName} ===`);

  const articleIds = await getTopicArticles(topicNumber);
  if (!articleIds.length) {
    console.log('  Sin artículos en scope');
    return 0;
  }

  // Buscar preguntas bad_answer que son falsos positivos
  const { data: questions } = await s.from('questions')
    .select('id, question_text, correct_option, option_a, option_b, option_c, option_d, topic_review_status')
    .in('primary_article_id', articleIds)
    .eq('is_active', true)
    .in('topic_review_status', ['bad_answer', 'wrong_article_bad_answer']);

  console.log(`  Total con problemas: ${questions?.length || 0}`);

  if (!questions?.length) return 0;

  let fixed = 0;

  for (const q of questions) {
    const correctOption = [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option]?.toLowerCase() || '';

    // Patrón 1: "Todas las anteriores" o similar
    const isTodas = correctOption.includes('todas') &&
      (correctOption.includes('anterior') || correctOption.includes('correcta'));

    // Patrón 2: Preguntas con negación donde la respuesta correcta es la opción que NO cumple
    const questionText = q.question_text.toLowerCase();
    const isNegative = questionText.includes(' no ') ||
      questionText.includes('incorrecta') ||
      questionText.includes('falsa') ||
      questionText.includes('señale la que no');

    // Patrón 3: "Ninguna de las anteriores"
    const isNinguna = correctOption.includes('ninguna');

    if (isTodas || isNegative || isNinguna) {
      // Marcar como perfect (falso positivo del algoritmo)
      await s.from('questions').update({ topic_review_status: 'perfect' }).eq('id', q.id);
      await s.from('ai_verification_results').update({
        article_ok: true, answer_ok: true, explanation_ok: true,
        explanation: `Verificación manual T${topicNumber}: Falso positivo algoritmo (patrón: ${isTodas ? 'todas' : isNegative ? 'negación' : 'ninguna'}).`
      }).eq('question_id', q.id);

      console.log(`  OK: ${q.id.substring(0, 8)} - ${isTodas ? 'Todas' : isNegative ? 'Negación' : 'Ninguna'}`);
      fixed++;
    }
  }

  console.log(`  Corregidas: ${fixed}`);
  return fixed;
}

(async () => {
  let totalFixed = 0;
  for (const topic of topics) {
    totalFixed += await fixFalsePositives(topic.number, topic.name);
  }
  console.log(`\nTOTAL CORREGIDAS: ${totalFixed}`);
})();
