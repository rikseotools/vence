const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const userId = '602de7cd-7c03-46d1-9290-21380f581c5f';

  console.log('═'.repeat(80));
  console.log('VERIFICACIÓN FINAL - Tests de Bego Saiz (begosaiz85@gmail.com)');
  console.log('═'.repeat(80));
  console.log('');

  const { data: tests } = await supabase
    .from('tests')
    .select('id, score, total_questions, started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(10);

  console.log('Últimos 10 tests:\n');

  let allCorrect = true;

  for (const test of tests) {
    // Obtener respuestas reales
    const { data: answers } = await supabase
      .from('test_questions')
      .select('is_correct')
      .eq('test_id', test.id);

    if (!answers || answers.length === 0) continue;

    const correctCount = answers.filter(a => a.is_correct).length;
    const totalQuestions = answers.length;
    const expectedScore = Math.round((correctCount / totalQuestions) * 100);

    const isCorrect = test.score === expectedScore;
    if (!isCorrect) allCorrect = false;

    console.log(new Date(test.started_at).toLocaleDateString('es-ES'));
    console.log('  Test ID:', test.id.substring(0, 8) + '...');
    console.log('  Preguntas:', totalQuestions);
    console.log('  Correctas:', correctCount);
    console.log('  Score en BD:', test.score + '%');
    console.log('  Score esperado:', expectedScore + '%');
    console.log('  Estado:', isCorrect ? '✅ CORRECTO' : '❌ INCORRECTO');
    console.log('');
  }

  console.log('═'.repeat(80));
  if (allCorrect) {
    console.log('✅ TODOS LOS TESTS DE BEGO ESTÁN CORRECTOS');
    console.log('');
    console.log('La usuaria ahora verá sus puntuaciones reales.');
    console.log('El problema está 100% solucionado.');
  } else {
    console.log('⚠️ Algunos tests todavía tienen scores incorrectos');
  }
  console.log('═'.repeat(80));
})();
