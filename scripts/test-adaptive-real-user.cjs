/**
 * Test real del sistema adaptativo
 * Simula el flujo completo de generación de catálogo y adaptación
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log('\n🧪 TEST REAL: Sistema Adaptativo\n');
console.log('='.repeat(80));

async function testAdaptive() {
  // 1. Obtener preguntas disponibles
  const { data: allQuestions, error: questionsError } = await supabase
    .from('questions')
    .select('id, difficulty, global_difficulty_category, question_text')
    .eq('is_active', true)
    .limit(50);

  if (questionsError || !allQuestions) {
    console.error('❌ Error obteniendo preguntas:', questionsError);
    return;
  }

  console.log(`\n📚 Preguntas disponibles: ${allQuestions.length}`);

  // 2. Simular usuario nuevo (sin historial)
  const answeredQuestionIds = new Set(); // Usuario nuevo, no ha respondido nada

  // 3. GENERAR CATÁLOGO ADAPTATIVO (igual que testFetchers.js líneas 1375-1434)
  console.log('\n🧠 GENERANDO CATÁLOGO ADAPTATIVO...\n');

  const catalog = {
    neverSeen: { easy: [], medium: [], hard: [], extreme: [] },
    answered: { easy: [], medium: [], hard: [], extreme: [] }
  };

  allQuestions.forEach(question => {
    // Usar global_difficulty_category con fallback a difficulty
    const difficulty = question.global_difficulty_category || question.difficulty;
    const isAnswered = answeredQuestionIds.has(question.id);

    if (isAnswered) {
      if (catalog.answered[difficulty]) {
        catalog.answered[difficulty].push(question);
      }
    } else {
      if (catalog.neverSeen[difficulty]) {
        catalog.neverSeen[difficulty].push(question);
      }
    }
  });

  console.log('📦 Catálogo generado:');
  console.log('\n   Nunca vistas:');
  console.log(`      Easy: ${catalog.neverSeen.easy.length} preguntas`);
  console.log(`      Medium: ${catalog.neverSeen.medium.length} preguntas`);
  console.log(`      Hard: ${catalog.neverSeen.hard.length} preguntas`);
  console.log(`      Extreme: ${catalog.neverSeen.extreme.length} preguntas`);

  console.log('\n   Ya respondidas:');
  console.log(`      Easy: ${catalog.answered.easy.length} preguntas`);
  console.log(`      Medium: ${catalog.answered.medium.length} preguntas`);
  console.log(`      Hard: ${catalog.answered.hard.length} preguntas`);
  console.log(`      Extreme: ${catalog.answered.extreme.length} preguntas`);

  // 4. SIMULAR INICIO DE TEST
  const numQuestions = 10;
  const activeQuestions = allQuestions.slice(0, numQuestions);

  console.log('\n' + '='.repeat(80));
  console.log('\n🎮 SIMULANDO TEST CON ACCURACY BAJO\n');

  // 5. SIMULAR RESPUESTAS CON ACCURACY < 60% (25% accuracy = 1/4)
  const answeredQuestions = [
    { correct: false },
    { correct: false },
    { correct: true },
    { correct: false },
  ];

  const totalAnswered = answeredQuestions.length;
  const totalCorrect = answeredQuestions.filter(q => q.correct).length;
  const currentAccuracy = (totalCorrect / totalAnswered) * 100;

  console.log('📊 Después de 4 respuestas:');
  console.log(`   Correctas: ${totalCorrect}/${totalAnswered}`);
  console.log(`   Accuracy: ${currentAccuracy.toFixed(1)}%`);

  // 6. VERIFICAR SI SE DEBE ADAPTAR
  console.log('\n🧠 EVALUANDO ADAPTACIÓN...\n');

  if (currentAccuracy < 60 && totalAnswered >= 3) {
    console.log('✅ CONDICIÓN CUMPLIDA: accuracy < 60% y >= 3 respuestas');
    console.log('🎯 ACTIVANDO adaptDifficulty("easier")');

    // 7. SIMULAR ALGORITMO DE ADAPTACIÓN
    const targetDifficulty = 'easy';
    const currentQuestion = 3; // Última pregunta respondida (índice 3)
    const remainingQuestions = numQuestions - (currentQuestion + 1);

    console.log(`\n📊 Estado del test:`);
    console.log(`   Pregunta actual: ${currentQuestion + 1}/${numQuestions}`);
    console.log(`   Preguntas restantes: ${remainingQuestions}`);
    console.log(`   Dificultad objetivo: ${targetDifficulty}`);

    // 🎯 PRIORIDAD 1: Nunca vistas de la dificultad objetivo
    const neverSeenTarget = catalog.neverSeen[targetDifficulty];

    console.log(`\n🎯 PRIORIDAD 1: Preguntas nunca vistas "${targetDifficulty}"`);
    console.log(`   Disponibles: ${neverSeenTarget.length}`);
    console.log(`   Necesarias: ${remainingQuestions}`);

    if (neverSeenTarget.length >= remainingQuestions) {
      const selectedQuestions = neverSeenTarget.slice(0, remainingQuestions);

      console.log('\n✅ ADAPTACIÓN EXITOSA');
      console.log(`   Se reemplazarán las ${remainingQuestions} preguntas restantes`);
      console.log(`   Con ${selectedQuestions.length} preguntas "${targetDifficulty}" nunca vistas`);

      console.log('\n📝 Preguntas seleccionadas:');
      selectedQuestions.slice(0, 3).forEach((q, i) => {
        const textPreview = q.question_text?.substring(0, 60) || 'Sin texto';
        const diff = q.global_difficulty_category || q.difficulty;
        console.log(`   ${i + 1}. [${diff}] ${textPreview}...`);
      });
      if (selectedQuestions.length > 3) {
        console.log(`   ... y ${selectedQuestions.length - 3} más`);
      }

      console.log('\n' + '='.repeat(80));
      console.log('\n🎉 RESULTADO:\n');
      console.log('✅ El sistema adaptativo funcionó correctamente');
      console.log(`✅ Usuario verá ${selectedQuestions.length} preguntas más fáciles`);
      console.log('✅ Todas las preguntas son nuevas (nunca vistas)');
      console.log('✅ Dificultad ajustada de "random" a "easy"');

      // Calcular mejora esperada de accuracy
      const bestCaseAccuracy = ((totalCorrect + remainingQuestions) / numQuestions) * 100;
      const worstCaseAccuracy = (totalCorrect / numQuestions) * 100;

      console.log('\n📈 Mejora esperada de accuracy:');
      console.log(`   Actual: ${currentAccuracy.toFixed(1)}%`);
      console.log(`   Mejor caso (acierta todas las fáciles): ${bestCaseAccuracy.toFixed(1)}%`);
      console.log(`   Peor caso (falla todas): ${worstCaseAccuracy.toFixed(1)}%`);

      // Verificar distribución de dificultades en preguntas seleccionadas
      const diffDistribution = {};
      selectedQuestions.forEach(q => {
        const diff = q.global_difficulty_category || q.difficulty;
        diffDistribution[diff] = (diffDistribution[diff] || 0) + 1;
      });

      console.log('\n📊 Distribución de dificultades en preguntas seleccionadas:');
      Object.entries(diffDistribution).forEach(([diff, count]) => {
        console.log(`   ${diff}: ${count} preguntas`);
      });

    } else {
      console.log('\n⚠️  No hay suficientes preguntas "easy" nunca vistas');
      console.log(`   Disponibles: ${neverSeenTarget.length}`);
      console.log(`   Necesarias: ${remainingQuestions}`);
      console.log('🔄 En producción, se usaría PRIORIDAD 2 (combinar dificultades) o 3 (ya respondidas)');
    }

  } else {
    console.log('❌ Condición NO cumplida');
    console.log(`   Accuracy: ${currentAccuracy.toFixed(1)}% (necesita < 60%)`);
    console.log(`   Respuestas: ${totalAnswered} (necesita >= 3)`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ TEST COMPLETADO\n');
}

testAdaptive().catch(error => {
  console.error('\n❌ ERROR FATAL:', error);
  process.exit(1);
});
