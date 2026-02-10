require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, exam_source, is_official_exam, primary_article_id, explanation')
    .eq('is_active', true)
    .order('question_text');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Group by question_text
  const textMap = new Map();
  data.forEach(q => {
    const normalized = q.question_text.trim().toLowerCase();
    if (!textMap.has(normalized)) {
      textMap.set(normalized, []);
    }
    textMap.get(normalized).push(q);
  });

  // Find cases with different correct answers
  const differentAnswers = [];

  for (const [text, questions] of textMap) {
    if (questions.length < 2) continue;

    const q1 = questions[0];
    const q2 = questions[1];

    // Get correct answer text for each
    const correctText1 = [q1.option_a, q1.option_b, q1.option_c, q1.option_d][q1.correct_option];
    const correctText2 = [q2.option_a, q2.option_b, q2.option_c, q2.option_d][q2.correct_option];

    const sameCorrect = (correctText1 || '').trim().toLowerCase() === (correctText2 || '').trim().toLowerCase();

    if (!sameCorrect) {
      differentAnswers.push({ q1, q2, correctText1, correctText2 });
    }
  }

  console.log('=== PREGUNTAS CON RESPUESTA CORRECTA DIFERENTE ===');
  console.log('Total:', differentAnswers.length);
  console.log('');

  differentAnswers.forEach((item, idx) => {
    console.log('══════════════════════════════════════════════════════════════');
    console.log('CASO', idx + 1);
    console.log('══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('PREGUNTA:', item.q1.question_text);
    console.log('');

    console.log('--- VERSION 1 ---');
    console.log('ID:', item.q1.id);
    console.log('Tipo:', item.q1.is_official_exam ? 'OFICIAL' : 'no-oficial');
    console.log('Examen:', item.q1.exam_source || 'N/A');
    console.log('Tiene explicación:', item.q1.explanation ? 'Sí' : 'No');
    console.log('Artículo vinculado:', item.q1.primary_article_id ? 'Sí' : 'No');
    console.log('');
    console.log('  A)', item.q1.option_a);
    console.log('  B)', item.q1.option_b);
    console.log('  C)', item.q1.option_c);
    console.log('  D)', item.q1.option_d);
    console.log('');
    console.log('  >>> CORRECTA:', ['A', 'B', 'C', 'D'][item.q1.correct_option]);
    if (item.q1.explanation) {
      console.log('  Explicación:', item.q1.explanation.substring(0, 200) + '...');
    }
    console.log('');

    console.log('--- VERSION 2 ---');
    console.log('ID:', item.q2.id);
    console.log('Tipo:', item.q2.is_official_exam ? 'OFICIAL' : 'no-oficial');
    console.log('Examen:', item.q2.exam_source || 'N/A');
    console.log('Tiene explicación:', item.q2.explanation ? 'Sí' : 'No');
    console.log('Artículo vinculado:', item.q2.primary_article_id ? 'Sí' : 'No');
    console.log('');
    console.log('  A)', item.q2.option_a);
    console.log('  B)', item.q2.option_b);
    console.log('  C)', item.q2.option_c);
    console.log('  D)', item.q2.option_d);
    console.log('');
    console.log('  >>> CORRECTA:', ['A', 'B', 'C', 'D'][item.q2.correct_option]);
    if (item.q2.explanation) {
      console.log('  Explicación:', item.q2.explanation.substring(0, 200) + '...');
    }
    console.log('');
    console.log('');
  });
})();
