/**
 * Extrae TODAS las preguntas del Tema 11 con artículo completo
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const LOPJ_ID = 'a3d58ada-b284-46f7-ab7c-2092d4bb06ff';
const RD_ID = 'c1700262-1ccb-41fd-a024-355d9795c441';

async function main() {
  // Obtener preguntas verificadas recientemente del Tema 11
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d,
      correct_option, explanation, topic_review_status,
      primary_article_id,
      articles(id, article_number, title, content, law_id,
        laws(id, short_name))
    `)
    .eq('is_active', true)
    .eq('verification_status', 'verified')
    .gte('verified_at', '2026-02-19')
    .order('verified_at', { ascending: false })
    .limit(150);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Filtrar solo del Tema 11 (LOPJ arts del LAJ o RD 1608)
  const tema11Questions = questions?.filter(q => {
    const law = q.articles?.laws?.short_name || '';
    const artNum = parseInt(q.articles?.article_number || '0');

    // LOPJ arts sobre LAJ (232-470)
    if (law.includes('6/1985') && artNum >= 232) return true;
    // RD 1608/2005
    if (law.includes('1608') || law.includes('Secretarios')) return true;

    return false;
  }) || [];

  console.log(`Total preguntas Tema 11: ${tema11Questions.length}`);

  // Preparar para revisión
  const reviewQuestions = tema11Questions.map((q, idx) => ({
    id: q.id,
    index: idx + 1,
    question_text: q.question_text,
    options: {
      A: q.option_a,
      B: q.option_b,
      C: q.option_c,
      D: q.option_d
    },
    correct_option: q.correct_option,
    correct_letter: ['A', 'B', 'C', 'D'][q.correct_option],
    explanation: q.explanation || '',
    current_status: q.topic_review_status,
    article: {
      id: q.articles?.id,
      number: q.articles?.article_number,
      title: q.articles?.title || '',
      content: q.articles?.content || '',
      law: q.articles?.laws?.short_name || ''
    }
  }));

  // Estadísticas
  const byLaw = {};
  reviewQuestions.forEach(q => {
    const law = q.article.law || 'Sin ley';
    byLaw[law] = (byLaw[law] || 0) + 1;
  });

  console.log('\nDistribución por ley:');
  Object.entries(byLaw).forEach(([law, count]) => console.log(`  ${law}: ${count}`));

  // Dividir en batches de 10
  const BATCH_SIZE = 10;
  const batches = [];
  for (let i = 0; i < reviewQuestions.length; i += BATCH_SIZE) {
    batches.push(reviewQuestions.slice(i, i + BATCH_SIZE));
  }

  batches.forEach((batch, idx) => {
    fs.writeFileSync(`/tmp/tema11-full-batch-${idx + 1}.json`, JSON.stringify(batch, null, 2));
  });

  console.log(`\nCreados ${batches.length} batches de ${BATCH_SIZE} preguntas`);

  // Guardar total
  fs.writeFileSync('/tmp/tema11-full-review.json', JSON.stringify(reviewQuestions, null, 2));
}

main().catch(console.error);
