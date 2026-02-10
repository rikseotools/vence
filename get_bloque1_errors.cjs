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

  // Topic IDs del Bloque I de Auxiliar Administrativo del Estado
  const topicIds = [
    '4e93bf25-ba58-4b36-a8e9-6c2f0f3d8a1b', // T1: Constitución
    '28c6ba47-1234-4567-89ab-cdef01234567', // T2: Tribunal Constitucional
    'f6019c53-1234-4567-89ab-cdef01234567', // T3: Cortes Generales
    'deace357-1234-4567-89ab-cdef01234567', // T4: Poder Judicial
    'e64110cd-1234-4567-89ab-cdef01234567', // T5: Gobierno y Administración
    'c4e5a1c9-1234-4567-89ab-cdef01234567', // T6: Gobierno Abierto
    '24316a04-1234-4567-89ab-cdef01234567', // T7: Transparencia
    'fdf6181d-1234-4567-89ab-cdef01234567', // T8: AGE
    '6047ed41-1234-4567-89ab-cdef01234567', // T9: Organización territorial
    '9fa3e8bb-1234-4567-89ab-cdef01234567', // T10: UE
    '4ceac74e-1234-4567-89ab-cdef01234567', // T11: Procedimiento Administrativo
    '4596812b-1234-4567-89ab-cdef01234567', // T12: Protección datos
    '81fcb655-1234-4567-89ab-cdef01234567', // T13: Personal funcionario
    'ca398540-1234-4567-89ab-cdef01234567', // T14: Derechos y deberes
    'e5c7a2cb-1234-4567-89ab-cdef01234567', // T15: Presupuesto
    '7eaa247f-1234-4567-89ab-cdef01234567'  // T16: Igualdad
  ];

  // Primero obtener los topics reales del Bloque I
  const { data: topics, error: topicsError } = await supabase
    .from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'auxiliar_administrativo')
    .gte('topic_number', 1)
    .lte('topic_number', 16);

  if (topicsError) {
    console.error('Error obteniendo topics:', topicsError);
    return;
  }

  console.log('Topics del Bloque I encontrados:', topics?.length || 0);
  for (const t of topics || []) {
    console.log(`  T${t.topic_number}: ${t.title} [${t.id.substring(0, 8)}]`);
  }

  const allQuestions = [];

  for (const topic of topics || []) {
    // Obtener scope del tema
    const { data: scope, error: scopeError } = await supabase
      .from('topic_scope')
      .select('law_id, article_numbers')
      .eq('topic_id', topic.id);

    if (scopeError) {
      console.error(`Error scope para topic ${topic.topic_number}:`, scopeError);
      continue;
    }

    // Obtener article IDs de todas las leyes del scope
    let articleIds = [];
    for (const s of scope || []) {
      if (!s.article_numbers || s.article_numbers.length === 0) continue;

      const { data: arts, error: artsError } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', s.law_id)
        .in('article_number', s.article_numbers);

      if (!artsError && arts) {
        articleIds.push(...arts.map(a => a.id));
      }
    }

    if (articleIds.length === 0) {
      console.log(`  T${topic.topic_number}: Sin artículos vinculados`);
      continue;
    }

    // Obtener preguntas con errores
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, topic_review_status, primary_article_id,
        articles!inner(id, article_number, title, content, law_id,
          laws!inner(id, short_name, name))
      `)
      .eq('is_active', true)
      .in('primary_article_id', articleIds)
      .in('topic_review_status', errorStates);

    if (qError) {
      console.error(`Error preguntas para topic ${topic.topic_number}:`, qError);
      continue;
    }

    console.log(`  T${topic.topic_number}: ${questions?.length || 0} preguntas con errores`);

    for (const q of questions || []) {
      allQuestions.push({
        id: q.id,
        topic_number: topic.topic_number,
        topic_title: topic.title,
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
        article_content: q.articles?.content,
        law_short_name: q.articles?.laws?.short_name
      });
    }
  }

  // Ordenar por topic_number
  allQuestions.sort((a, b) => a.topic_number - b.topic_number);

  require('fs').writeFileSync('bloque1_error_questions.json', JSON.stringify(allQuestions, null, 2));
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Total preguntas con errores en Bloque I:', allQuestions.length);
  console.log('Archivo generado: bloque1_error_questions.json');
  console.log('═══════════════════════════════════════════════════════════════');

  // Resumen por estado
  const byStatus = {};
  for (const q of allQuestions) {
    byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1;
  }
  console.log('\nResumen por estado:');
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${count}`);
  }
}

main().catch(console.error);
