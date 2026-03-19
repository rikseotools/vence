require('dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Extraer preguntas con tags 'Tema 6' e 'IA-Verified'
  const { data: questions, error } = await supabase
    .from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d,
      correct_option, explanation, topic_review_status, primary_article_id,
      articles!inner(id, article_number, title, content, law_id,
        laws!inner(id, short_name, name))
    `)
    .eq('is_active', true)
    .contains('tags', ['Tema 6', 'IA-Verified']);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total preguntas importadas Tema 6:', questions.length);

  // Preparar para revisión
  const forReview = questions.map(q => ({
    id: q.id,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_option: q.correct_option,
    correct_letter: ['A', 'B', 'C', 'D'][q.correct_option],
    explanation: q.explanation,
    topic_review_status: q.topic_review_status,
    article_number: q.articles?.article_number,
    article_title: q.articles?.title,
    article_content: q.articles?.content,
    law_short_name: q.articles?.laws?.short_name
  }));

  // Guardar todas las preguntas
  fs.writeFileSync('/tmp/tema6-all-for-review.json', JSON.stringify(forReview, null, 2));

  // Dividir en lotes de 20
  const batchSize = 20;
  const batches = [];
  for (let i = 0; i < forReview.length; i += batchSize) {
    batches.push(forReview.slice(i, i + batchSize));
  }

  console.log('Lotes creados:', batches.length);

  // Guardar cada lote
  for (let i = 0; i < batches.length; i++) {
    fs.writeFileSync(`/tmp/tema6-review-batch-${i + 1}.json`, JSON.stringify(batches[i], null, 2));
    console.log(`Batch ${i + 1}: ${batches[i].length} preguntas`);
  }

  // Estadísticas por ley
  const byLaw = {};
  for (const q of forReview) {
    const law = q.law_short_name || 'Sin ley';
    byLaw[law] = (byLaw[law] || 0) + 1;
  }
  console.log('\nDistribución por ley:');
  Object.entries(byLaw).forEach(([law, count]) => {
    console.log(`  ${law}: ${count}`);
  });
}

main().catch(console.error);
