const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const errorStates = [
    'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
    'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
    'tech_bad_answer', 'tech_bad_explanation', 'tech_bad_answer_and_explanation'
  ];

  // T10: La organización de la Unión Europea
  const topicId = '9fa3e8bb-ab30-4c5b-a07b-3e6c09b2e4d1';

  // Obtener el topic real
  const { data: topic } = await supabase
    .from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'auxiliar_administrativo')
    .eq('topic_number', 10)
    .single();

  if (!topic) {
    console.log('No se encontró el topic T10');
    return;
  }

  console.log('Topic:', topic.title);
  console.log('ID:', topic.id);

  // Obtener scope del tema
  const { data: scope } = await supabase
    .from('topic_scope')
    .select('law_id, article_numbers, laws(short_name)')
    .eq('topic_id', topic.id);

  console.log('\nScope del tema:');
  for (const s of scope || []) {
    console.log('  -', s.laws?.short_name, ':', s.article_numbers?.length || 0, 'artículos');
  }

  // Obtener article IDs
  let articleIds = [];
  for (const s of scope || []) {
    if (!s.article_numbers || s.article_numbers.length === 0) continue;
    const { data: arts } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', s.law_id)
      .in('article_number', s.article_numbers);
    if (arts) articleIds.push(...arts.map(a => a.id));
  }

  console.log('Total artículos:', articleIds.length);

  // Obtener preguntas con errores
  const { data: questions } = await supabase
    .from('questions')
    .select(`
      id, question_text, option_a, option_b, option_c, option_d,
      correct_option, explanation, topic_review_status, primary_article_id,
      articles(id, article_number, title, content, laws(short_name))
    `)
    .eq('is_active', true)
    .in('primary_article_id', articleIds)
    .in('topic_review_status', errorStates);

  console.log('\nPreguntas con errores:', questions?.length || 0);

  // Guardar para análisis
  const output = (questions || []).map(q => ({
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

  require('fs').writeFileSync('t10_errors.json', JSON.stringify(output, null, 2));

  // Mostrar resumen
  console.log('\nResumen por estado:');
  const byStatus = {};
  for (const q of output) {
    byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1;
  }
  for (const [status, count] of Object.entries(byStatus)) {
    console.log('  ', status, ':', count);
  }
}

main().catch(console.error);
