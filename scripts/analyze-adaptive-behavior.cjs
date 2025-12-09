/**
 * Analiza el comportamiento adaptativo buscando patrones de cambio de dificultad
 * durante tests basándose en el accuracy del usuario
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function analyzeAdaptiveBehavior() {
  console.log('\n🔍 ANÁLISIS: Comportamiento Adaptativo en Tests Reales\n');
  console.log('='.repeat(80));

  // Obtener tests recientes con más de 10 preguntas
  const { data: tests, error: testsError } = await supabase
    .from('tests')
    .select('id, user_id, total_questions, score, created_at')
    .gte('total_questions', 10)
    .not('score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (testsError) {
    console.error('❌ Error obteniendo tests:', testsError);
    return;
  }

  console.log(`\n📊 Analizando ${tests.length} tests recientes...\n`);

  let testsWithAdaptivePattern = 0;
  let testsAnalyzed = 0;

  for (const test of tests) {
    // Obtener preguntas del test en orden
    const { data: testQuestions, error: tqError } = await supabase
      .from('test_questions')
      .select(`
        question_id,
        is_correct,
        created_at,
        questions!inner(
          difficulty,
          global_difficulty_category
        )
      `)
      .eq('test_id', test.id)
      .order('created_at', { ascending: true });

    if (tqError || !testQuestions || testQuestions.length < 10) {
      continue;
    }

    testsAnalyzed++;

    // Calcular accuracy por segmentos
    const segmentSize = Math.floor(testQuestions.length / 3);
    const firstSegment = testQuestions.slice(0, segmentSize);
    const secondSegment = testQuestions.slice(segmentSize, segmentSize * 2);
    const thirdSegment = testQuestions.slice(segmentSize * 2);

    const calcStats = (segment) => {
      const correct = segment.filter(q => q.is_correct).length;
      const total = segment.length;
      const accuracy = total > 0 ? (correct / total) * 100 : 0;

      // Contar dificultades
      const difficulties = {};
      segment.forEach(q => {
        const diff = q.questions.global_difficulty_category || q.questions.difficulty;
        difficulties[diff] = (difficulties[diff] || 0) + 1;
      });

      return { correct, total, accuracy, difficulties };
    };

    const stats1 = calcStats(firstSegment);
    const stats2 = calcStats(secondSegment);
    const stats3 = calcStats(thirdSegment);

    // Detectar patrón adaptativo:
    // 1. Accuracy cae en primer segmento (<60%)
    // 2. Dificultad disminuye en segundo/tercer segmento
    // 3. Accuracy mejora en tercer segmento

    const lowAccuracyStart = stats1.accuracy < 60;
    const accuracyImproved = stats3.accuracy > stats1.accuracy + 10;

    // Contar preguntas "easy" en cada segmento
    const easyInFirst = stats1.difficulties.easy || 0;
    const easyInThird = stats3.difficulties.easy || 0;
    const difficultyDecreased = easyInThird > easyInFirst;

    const showsAdaptivePattern = lowAccuracyStart && (difficultyDecreased || accuracyImproved);

    if (showsAdaptivePattern || testsAnalyzed <= 3) {
      // Mostrar primeros 3 tests siempre, luego solo los que muestran patrón
      console.log(`\n🎯 Test ${test.id.substring(0, 8)}... ${showsAdaptivePattern ? '✨ PATRÓN ADAPTATIVO DETECTADO' : ''}`);
      console.log(`   Usuario: ${test.user_id.substring(0, 8)}...`);
      console.log(`   Fecha: ${new Date(test.created_at).toLocaleString()}`);
      console.log(`   Total preguntas: ${testQuestions.length}`);
      console.log(`   Score final: ${test.score}/${test.total_questions} (${((test.score/test.total_questions)*100).toFixed(1)}%)`);

      console.log(`\n   📊 Análisis por segmentos:`);

      console.log(`\n   Primer tercio (preguntas 1-${segmentSize}):`);
      console.log(`      Accuracy: ${stats1.accuracy.toFixed(1)}% (${stats1.correct}/${stats1.total})`);
      console.log(`      Dificultades:`, stats1.difficulties);

      console.log(`\n   Segundo tercio (preguntas ${segmentSize + 1}-${segmentSize * 2}):`);
      console.log(`      Accuracy: ${stats2.accuracy.toFixed(1)}% (${stats2.correct}/${stats2.total})`);
      console.log(`      Dificultades:`, stats2.difficulties);

      console.log(`\n   Tercer tercio (preguntas ${segmentSize * 2 + 1}-${testQuestions.length}):`);
      console.log(`      Accuracy: ${stats3.accuracy.toFixed(1)}% (${stats3.correct}/${stats3.total})`);
      console.log(`      Dificultades:`, stats3.difficulties);

      if (showsAdaptivePattern) {
        console.log(`\n   ✨ EVIDENCIA DE ADAPTACIÓN:`);
        if (lowAccuracyStart) {
          console.log(`      - Accuracy inicial baja: ${stats1.accuracy.toFixed(1)}%`);
        }
        if (difficultyDecreased) {
          console.log(`      - Preguntas fáciles aumentaron: ${easyInFirst} → ${easyInThird}`);
        }
        if (accuracyImproved) {
          console.log(`      - Accuracy mejoró: ${stats1.accuracy.toFixed(1)}% → ${stats3.accuracy.toFixed(1)}%`);
        }
        testsWithAdaptivePattern++;
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RESUMEN:');
  console.log(`   Tests analizados: ${testsAnalyzed}`);
  console.log(`   Tests con patrón adaptativo: ${testsWithAdaptivePattern}`);

  if (testsWithAdaptivePattern === 0) {
    console.log('\n❌ DIAGNÓSTICO:');
    console.log('   NO se detectaron patrones adaptativos en los tests analizados');
    console.log('\n🔍 POSIBLES RAZONES:');
    console.log('   1. El modo adaptativo NO está activo');
    console.log('   2. La función adaptDifficulty() NO se está ejecutando');
    console.log('   3. El catálogo adaptativo NO se está generando');
    console.log('   4. Los usuarios tienen accuracy > 60% (no activa adaptación)');
    console.log('\n💡 RECOMENDACIÓN:');
    console.log('   Revisar logs del navegador durante un test para ver si:');
    console.log('   - Se muestra "🧠 Modo adaptativo disponible (pool cargado)"');
    console.log('   - Se ejecuta adaptDifficulty()');
    console.log('   - Se detecta "🧠 Accuracy < 60%, adaptando..."');
  } else {
    console.log(`\n✅ Se detectaron ${testsWithAdaptivePattern} tests con comportamiento adaptativo`);
    console.log('   Esto sugiere que el sistema SÍ está funcionando en algunos casos');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

analyzeAdaptiveBehavior().catch(error => {
  console.error('\n❌ ERROR FATAL:', error);
  process.exit(1);
});
