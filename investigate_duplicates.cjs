require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, option_a, option_b, option_c, option_d, correct_option, exam_source, is_official_exam')
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

  // Analyze duplicates
  let sameOptionsShuffled = 0;
  let sameOptionsExact = 0;
  let differentOptions = 0;
  let sameCorrectAnswer = 0;
  let differentCorrectAnswer = 0;

  const examples = {
    shuffled: [],
    exact: [],
    different: [],
    differentAnswer: []
  };

  for (const [text, questions] of textMap) {
    if (questions.length < 2) continue;

    const q1 = questions[0];
    const q2 = questions[1];

    const opts1 = [q1.option_a, q1.option_b, q1.option_c, q1.option_d].map(o => (o || '').trim().toLowerCase());
    const opts2 = [q2.option_a, q2.option_b, q2.option_c, q2.option_d].map(o => (o || '').trim().toLowerCase());

    const opts1Sorted = [...opts1].sort();
    const opts2Sorted = [...opts2].sort();

    const exactSame = opts1.every((o, idx) => o === opts2[idx]);
    const sameSorted = opts1Sorted.every((o, idx) => o === opts2Sorted[idx]);

    // Check if correct answer text is the same
    const correctText1 = [q1.option_a, q1.option_b, q1.option_c, q1.option_d][q1.correct_option];
    const correctText2 = [q2.option_a, q2.option_b, q2.option_c, q2.option_d][q2.correct_option];
    const sameCorrect = (correctText1 || '').trim().toLowerCase() === (correctText2 || '').trim().toLowerCase();

    if (sameCorrect) {
      sameCorrectAnswer++;
    } else {
      differentCorrectAnswer++;
      if (examples.differentAnswer.length < 5) {
        examples.differentAnswer.push({ q1, q2, correctText1, correctText2 });
      }
    }

    if (exactSame) {
      sameOptionsExact++;
      if (examples.exact.length < 2) {
        examples.exact.push({ q1, q2 });
      }
    } else if (sameSorted) {
      sameOptionsShuffled++;
      if (examples.shuffled.length < 2) {
        examples.shuffled.push({ q1, q2 });
      }
    } else {
      differentOptions++;
      if (examples.different.length < 5) {
        examples.different.push({ q1, q2, opts1, opts2 });
      }
    }
  }

  console.log('=== ANALISIS DE DUPLICADOS ===\n');
  console.log('Opciones EXACTAMENTE iguales (mismo orden):', sameOptionsExact);
  console.log('Opciones iguales pero BARAJADAS:', sameOptionsShuffled);
  console.log('Opciones DIFERENTES:', differentOptions);
  console.log('\nRespuesta correcta IGUAL:', sameCorrectAnswer);
  console.log('Respuesta correcta DIFERENTE:', differentCorrectAnswer);

  if (examples.differentAnswer.length > 0) {
    console.log('\n\n=== EJEMPLOS CON RESPUESTA CORRECTA DIFERENTE ===');
    examples.differentAnswer.forEach((ex, idx) => {
      console.log('\n--- Ejemplo ' + (idx + 1) + ' ---');
      console.log('Pregunta:', ex.q1.question_text.substring(0, 100) + '...');
      console.log('\nVERSION 1:', ex.q1.is_official_exam ? 'OFICIAL' : 'no-oficial', '(' + (ex.q1.exam_source || 'sin examen').substring(0, 40) + ')');
      console.log('  A)', ex.q1.option_a);
      console.log('  B)', ex.q1.option_b);
      console.log('  C)', ex.q1.option_c);
      console.log('  D)', ex.q1.option_d);
      console.log('  CORRECTA:', ['A', 'B', 'C', 'D'][ex.q1.correct_option]);
      console.log('\nVERSION 2:', ex.q2.is_official_exam ? 'OFICIAL' : 'no-oficial', '(' + (ex.q2.exam_source || 'sin examen').substring(0, 40) + ')');
      console.log('  A)', ex.q2.option_a);
      console.log('  B)', ex.q2.option_b);
      console.log('  C)', ex.q2.option_c);
      console.log('  D)', ex.q2.option_d);
      console.log('  CORRECTA:', ['A', 'B', 'C', 'D'][ex.q2.correct_option]);
    });
  }

  if (examples.different.length > 0) {
    console.log('\n\n=== EJEMPLOS CON OPCIONES DIFERENTES (no son el mismo set) ===');
    examples.different.forEach((ex, idx) => {
      console.log('\n--- Ejemplo ' + (idx + 1) + ' ---');
      console.log('Pregunta:', ex.q1.question_text.substring(0, 100) + '...');
      console.log('\nVERSION 1:', ex.q1.is_official_exam ? 'OFICIAL' : 'no-oficial');
      console.log('  A)', ex.q1.option_a);
      console.log('  B)', ex.q1.option_b);
      console.log('  C)', ex.q1.option_c);
      console.log('  D)', ex.q1.option_d);
      console.log('\nVERSION 2:', ex.q2.is_official_exam ? 'OFICIAL' : 'no-oficial');
      console.log('  A)', ex.q2.option_a);
      console.log('  B)', ex.q2.option_b);
      console.log('  C)', ex.q2.option_c);
      console.log('  D)', ex.q2.option_d);
    });
  }
})();
