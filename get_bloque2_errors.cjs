const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const errorStates = [
  'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
  'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
  'tech_bad_answer', 'tech_bad_explanation', 'tech_bad_answer_and_explanation'
];

async function main() {
  // Obtener topics del bloque II auxiliar
  const { data: topics } = await supabase
    .from('topics')
    .select('id, topic_number, title')
    .eq('position_type', 'auxiliar_administrativo')
    .gte('topic_number', 101)
    .lte('topic_number', 112)
    .order('topic_number');

  console.log('Topics encontrados:', topics?.length);
  topics?.forEach(t => console.log('  T' + t.topic_number + ':', t.title, '(' + t.id + ')'));

  const allQuestions = [];

  for (const topic of topics || []) {
    // Obtener scope del tema
    const { data: scope } = await supabase
      .from('topic_scope')
      .select('law_id, article_numbers')
      .eq('topic_id', topic.id);

    // Obtener article IDs
    let articleIds = [];
    for (const s of scope || []) {
      if (s.article_numbers && s.article_numbers.length > 0) {
        const { data: arts } = await supabase
          .from('articles')
          .select('id')
          .eq('law_id', s.law_id)
          .in('article_number', s.article_numbers);
        articleIds.push(...(arts?.map(a => a.id) || []));
      }
    }

    // Para temas técnicos sin artículos reales, buscar por topic_id
    if (articleIds.length === 0) {
      const { data: questions } = await supabase
        .from('questions')
        .select(`
          id, question_text, option_a, option_b, option_c, option_d,
          correct_option, explanation, topic_review_status, primary_article_id,
          articles(id, article_number, title, content, law_id,
            laws(id, short_name, name))
        `)
        .eq('is_active', true)
        .eq('topic_id', topic.id)
        .in('topic_review_status', errorStates);

      for (const q of questions || []) {
        allQuestions.push({
          id: q.id,
          topic_number: topic.topic_number,
          topic_title: topic.title,
          question_text: q.question_text,
          option_a: q.option_a, option_b: q.option_b,
          option_c: q.option_c, option_d: q.option_d,
          correct_option: q.correct_option,
          correct_letter: ['A', 'B', 'C', 'D'][q.correct_option],
          explanation: q.explanation,
          topic_review_status: q.topic_review_status,
          article_content: q.articles?.content || null,
          article_number: q.articles?.article_number || null,
          article_title: q.articles?.title || null,
          law_short_name: q.articles?.laws?.short_name || 'Tema técnico'
        });
      }
      continue;
    }

    // Obtener preguntas con errores vinculadas a artículos del scope
    const { data: questions } = await supabase
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

    for (const q of questions || []) {
      allQuestions.push({
        id: q.id,
        topic_number: topic.topic_number,
        topic_title: topic.title,
        question_text: q.question_text,
        option_a: q.option_a, option_b: q.option_b,
        option_c: q.option_c, option_d: q.option_d,
        correct_option: q.correct_option,
        correct_letter: ['A', 'B', 'C', 'D'][q.correct_option],
        explanation: q.explanation,
        topic_review_status: q.topic_review_status,
        article_content: q.articles?.content,
        article_number: q.articles?.article_number,
        article_title: q.articles?.title,
        law_short_name: q.articles?.laws?.short_name
      });
    }
  }

  // Resumen por topic
  const byTopic = {};
  allQuestions.forEach(q => {
    const key = 'T' + q.topic_number;
    if (!byTopic[key]) byTopic[key] = { count: 0, statuses: {} };
    byTopic[key].count++;
    const st = q.topic_review_status;
    byTopic[key].statuses[st] = (byTopic[key].statuses[st] || 0) + 1;
  });

  console.log('\nResumen de errores por topic:');
  Object.entries(byTopic).forEach(([k, v]) => {
    console.log('  ' + k + ':', v.count, 'errores -', JSON.stringify(v.statuses));
  });

  console.log('\nTotal preguntas con errores:', allQuestions.length);

  require('fs').writeFileSync('bloque2_aux_errors.json', JSON.stringify(allQuestions, null, 2));
  console.log('Guardado en bloque2_aux_errors.json');
}

main().catch(console.error);
