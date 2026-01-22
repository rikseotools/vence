const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const userId = '602de7cd-7c03-46d1-9290-21380f581c5f';

  // Obtener tests con ID completo
  const { data: tests } = await supabase
    .from('tests')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(3);

  console.log('═'.repeat(80));
  console.log('TESTS MÁS RECIENTES CON DETALLES COMPLETOS');
  console.log('═'.repeat(80));
  console.log('');

  for (const test of tests) {
    console.log('Test ID:', test.id);
    console.log('Fecha:', new Date(test.started_at).toLocaleString('es-ES'));
    console.log('Score:', test.score + '%');
    console.log('Total preguntas:', test.total_questions);
    console.log('Correctas:', test.correct_answers);
    console.log('Incorrectas:', test.wrong_answers);
    console.log('Completado:', test.is_completed);
    console.log('');

    // Buscar respuestas en user_answers
    const { data: oldAnswers, error: oldError } = await supabase
      .from('user_answers')
      .select('*')
      .eq('test_id', test.id);

    console.log('Respuestas en user_answers:', oldAnswers ? oldAnswers.length : 0);
    if (oldError) console.log('Error:', oldError.message);

    if (oldAnswers && oldAnswers.length > 0) {
      const correct = oldAnswers.filter(a => a.is_correct).length;
      console.log('  Correctas según BD:', correct + '/' + oldAnswers.length);
      console.log('');
      console.log('  Muestra de respuestas:');
      oldAnswers.slice(0, 3).forEach((a, i) => {
        console.log('    ' + (i+1) + '. User answer:', a.user_answer, '/ Correct:', a.correct_option, '/ Es correcta:', a.is_correct);
      });
    }
    console.log('');

    // Buscar respuestas en detailed_answers
    const { data: newAnswers, error: newError } = await supabase
      .from('detailed_answers')
      .select('*')
      .eq('test_id', test.id);

    console.log('Respuestas en detailed_answers:', newAnswers ? newAnswers.length : 0);
    if (newError) console.log('Error:', newError.message);

    console.log('');
    console.log('─'.repeat(80));
    console.log('');
  }
})();
