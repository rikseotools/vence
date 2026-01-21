/**
 * Script para corregir scores de tests que fueron guardados incorrectamente
 *
 * PROBLEMA:
 * - Los tests guardaban el número absoluto de respuestas correctas (ej: 6)
 * - En lugar del porcentaje (ej: 100)
 *
 * SOLUCIÓN:
 * - Recalcular score = (correct_answers / total_questions) * 100
 * - Actualizar todos los tests que tienen score < 100 y deberían tener más
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('═'.repeat(80));
  console.log('CORRECCIÓN DE SCORES INCORRECTOS');
  console.log('═'.repeat(80));
  console.log('');

  // Obtener todos los tests completados con score sospechosamente bajo
  const { data: tests, error } = await supabase
    .from('tests')
    .select('id, user_id, score, total_questions, started_at')
    .eq('is_completed', true)
    .lt('score', 100) // Score menor a 100 (sospechoso)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Tests encontrados con score < 100: ${tests.length}`);
  console.log('');

  let fixed = 0;
  let errors = 0;

  for (const test of tests) {
    // Obtener respuestas del test
    const { data: answers } = await supabase
      .from('test_questions')
      .select('is_correct')
      .eq('test_id', test.id);

    if (!answers || answers.length === 0) {
      console.log(`⚠️ Test ${test.id.substring(0, 8)}... sin respuestas, saltando`);
      continue;
    }

    const correctCount = answers.filter(a => a.is_correct).length;
    const totalQuestions = answers.length;

    // Calcular score correcto
    const correctScore = Math.round((correctCount / totalQuestions) * 100);

    // Si el score actual es igual al número de respuestas correctas (bug)
    if (test.score === correctCount && test.score !== correctScore) {
      console.log(`🔧 Corrigiendo test ${test.id.substring(0, 8)}...`);
      console.log(`   Antes: ${test.score}% (número absoluto incorrecto)`);
      console.log(`   Después: ${correctScore}% (${correctCount}/${totalQuestions})`);

      const { error: updateError } = await supabase
        .from('tests')
        .update({ score: correctScore })
        .eq('id', test.id);

      if (updateError) {
        console.error(`   ❌ Error:`, updateError.message);
        errors++;
      } else {
        console.log(`   ✅ Corregido`);
        fixed++;
      }
      console.log('');
    }
  }

  console.log('═'.repeat(80));
  console.log('RESUMEN');
  console.log('═'.repeat(80));
  console.log(`Tests analizados: ${tests.length}`);
  console.log(`Tests corregidos: ${fixed}`);
  console.log(`Errores: ${errors}`);
  console.log('');

  if (fixed > 0) {
    console.log('✅ Scores corregidos exitosamente');
    console.log('');
    console.log('Los usuarios ahora verán sus puntuaciones correctas.');
  }
})();
