/**
 * Script para investigar a fondo si el modo adaptativo funciona correctamente
 * Analiza:
 * 1. Configuración en TestConfigurator
 * 2. Generación de catálogo adaptativo en testFetchers
 * 3. Lógica de adaptación en TestLayout
 * 4. Datos reales de usuarios usando modo adaptativo
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function investigateAdaptiveMode() {
  console.log('\n🔍 INVESTIGACIÓN PROFUNDA: MODO ADAPTATIVO\n');
  console.log('='.repeat(80));

  // ================== PARTE 1: VERIFICAR CONFIGURACIÓN ==================
  console.log('\n📋 PARTE 1: Verificación de Configuración del Modo Adaptativo');
  console.log('-'.repeat(80));

  // Buscar en el código si focusWeakAreas está disponible
  console.log('\n✅ Configuración en TestConfigurator:');
  console.log('   - focusWeakAreas: Debería estar disponible como opción');
  console.log('   - Se pasa a fetchQuestionsByTopicScope como configParams.focusWeakAreas');

  // ================== PARTE 2: VERIFICAR DATOS DE USUARIOS ==================
  console.log('\n\n📊 PARTE 2: Análisis de Usuarios que Usan Modo Adaptativo');
  console.log('-'.repeat(80));

  // Buscar tests con configuración que incluya focusWeakAreas
  const { data: testsWithWeakFocus, error: testsError } = await supabase
    .from('tests')
    .select('id, user_id, config, created_at')
    .not('config', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (testsError) {
    console.error('❌ Error obteniendo tests:', testsError);
  } else {
    // Filtrar tests que tengan focusWeakAreas en config
    const adaptiveTests = testsWithWeakFocus.filter(test => {
      try {
        const config = typeof test.config === 'string' ? JSON.parse(test.config) : test.config;
        return config?.focusWeakAreas === true;
      } catch (e) {
        return false;
      }
    });

    console.log(`\n📈 Tests con focusWeakAreas activado: ${adaptiveTests.length}/${testsWithWeakFocus.length}`);

    if (adaptiveTests.length > 0) {
      console.log('\n🔍 Últimos 5 tests adaptativos:');
      adaptiveTests.slice(0, 5).forEach((test, idx) => {
        const config = typeof test.config === 'string' ? JSON.parse(test.config) : test.config;
        console.log(`   ${idx + 1}. Test ${test.id.substring(0, 8)}...`);
        console.log(`      User: ${test.user_id.substring(0, 8)}...`);
        console.log(`      Config:`, {
          focusWeakAreas: config.focusWeakAreas,
          difficultyMode: config.difficultyMode,
          numQuestions: config.numQuestions
        });
        console.log(`      Fecha: ${new Date(test.created_at).toLocaleString()}`);
      });
    } else {
      console.log('⚠️ NO SE ENCONTRARON TESTS CON focusWeakAreas=true');
      console.log('   Esto sugiere que:');
      console.log('   - Los usuarios no están activando esta opción');
      console.log('   - O la opción no se está guardando correctamente');
    }
  }

  // ================== PARTE 3: VERIFICAR DISTRIBUCIÓN DE DIFICULTADES ==================
  console.log('\n\n📊 PARTE 3: Análisis de Distribución de Dificultades en Tests');
  console.log('-'.repeat(80));

  // Analizar un test adaptativo en detalle si existe
  if (testsWithWeakFocus && testsWithWeakFocus.length > 0) {
    const sampleTest = testsWithWeakFocus[0];

    const { data: testQuestions, error: tqError } = await supabase
      .from('test_questions')
      .select(`
        question_id,
        is_correct,
        questions!inner(
          difficulty,
          global_difficulty_category
        )
      `)
      .eq('test_id', sampleTest.id)
      .order('created_at', { ascending: true });

    if (!tqError && testQuestions && testQuestions.length > 0) {
      console.log(`\n🔬 Análisis detallado del test ${sampleTest.id.substring(0, 8)}...`);
      console.log(`   Total preguntas: ${testQuestions.length}`);

      // Analizar distribución de dificultades a lo largo del test
      const difficultyProgression = testQuestions.map((tq, idx) => {
        const diff = tq.questions.global_difficulty_category || tq.questions.difficulty;
        return {
          position: idx + 1,
          difficulty: diff,
          correct: tq.is_correct
        };
      });

      // Contar por dificultad
      const diffCounts = difficultyProgression.reduce((acc, item) => {
        acc[item.difficulty] = (acc[item.difficulty] || 0) + 1;
        return acc;
      }, {});

      console.log('\n   📊 Distribución de dificultades:');
      Object.entries(diffCounts).forEach(([diff, count]) => {
        const pct = ((count / testQuestions.length) * 100).toFixed(1);
        console.log(`      ${diff.padEnd(8)}: ${count.toString().padStart(3)} preguntas (${pct}%)`);
      });

      // Calcular accuracy por segmento
      const firstThird = difficultyProgression.slice(0, Math.floor(testQuestions.length / 3));
      const secondThird = difficultyProgression.slice(
        Math.floor(testQuestions.length / 3),
        Math.floor(2 * testQuestions.length / 3)
      );
      const lastThird = difficultyProgression.slice(Math.floor(2 * testQuestions.length / 3));

      const calcAccuracy = (segment) => {
        const correct = segment.filter(q => q.correct).length;
        return segment.length > 0 ? ((correct / segment.length) * 100).toFixed(1) : 'N/A';
      };

      console.log('\n   📈 Accuracy por segmento del test:');
      console.log(`      Primer tercio:  ${calcAccuracy(firstThird)}% de aciertos`);
      console.log(`      Segundo tercio: ${calcAccuracy(secondThird)}% de aciertos`);
      console.log(`      Último tercio:  ${calcAccuracy(lastThird)}% de aciertos`);

      // Verificar si hay cambio de dificultad
      const difficulties = difficultyProgression.map(d => d.difficulty);
      const uniqueDiffs = [...new Set(difficulties)];

      console.log('\n   🔄 Cambios de dificultad durante el test:');
      if (uniqueDiffs.length === 1) {
        console.log(`      ⚠️ PROBLEMA: Todas las preguntas son de dificultad "${uniqueDiffs[0]}"`);
        console.log('      Esto sugiere que el modo adaptativo NO está funcionando');
      } else {
        console.log(`      ✅ Se detectaron ${uniqueDiffs.length} niveles: ${uniqueDiffs.join(', ')}`);

        // Mostrar progresión
        console.log('\n   📍 Progresión de dificultades:');
        difficultyProgression.forEach((item, idx) => {
          if (idx === 0 || item.difficulty !== difficultyProgression[idx - 1].difficulty) {
            console.log(`      Pregunta ${item.position}: ${item.difficulty} ${item.correct ? '✓' : '✗'}`);
          }
        });
      }
    }
  }

  // ================== PARTE 4: VERIFICAR RPC get_weak_areas ==================
  console.log('\n\n🔧 PARTE 4: Verificación de RPC get_weak_areas');
  console.log('-'.repeat(80));

  // Buscar un usuario con historial
  const { data: userWithHistory } = await supabase
    .from('tests')
    .select('user_id')
    .not('user_id', 'is', null)
    .limit(1)
    .single();

  if (userWithHistory) {
    console.log(`\n🔍 Probando get_weak_areas para usuario ${userWithHistory.user_id.substring(0, 8)}...`);

    const { data: weakAreas, error: weakError } = await supabase
      .rpc('get_weak_areas', {
        p_user_id: userWithHistory.user_id
      });

    if (weakError) {
      console.error('❌ Error llamando RPC get_weak_areas:', weakError.message);
      console.log('   Esto podría indicar que la función RPC no existe o tiene problemas');
    } else if (!weakAreas || weakAreas.length === 0) {
      console.log('⚠️ RPC funciona pero no retornó áreas débiles');
      console.log('   Esto es normal si el usuario tiene buen rendimiento');
    } else {
      console.log(`✅ RPC funciona correctamente, retornó ${weakAreas.length} áreas débiles`);
      console.log('\n   Primeras 3 áreas débiles:');
      weakAreas.slice(0, 3).forEach((area, idx) => {
        console.log(`   ${idx + 1}. ${area.category || area.topic || 'N/A'}`);
        console.log(`      Accuracy: ${area.accuracy || area.success_rate || 'N/A'}%`);
        console.log(`      Intentos: ${area.attempts || area.total_attempts || 'N/A'}`);
      });
    }
  }

  // ================== PARTE 5: RESUMEN Y DIAGNÓSTICO ==================
  console.log('\n\n🎯 PARTE 5: Resumen y Diagnóstico');
  console.log('='.repeat(80));

  const adaptiveTestsCount = testsWithWeakFocus?.filter(test => {
    try {
      const config = typeof test.config === 'string' ? JSON.parse(test.config) : test.config;
      return config?.focusWeakAreas === true;
    } catch (e) {
      return false;
    }
  }).length || 0;

  console.log('\n📊 ESTADO ACTUAL DEL MODO ADAPTATIVO:');
  console.log(`   - Tests con focusWeakAreas: ${adaptiveTestsCount}`);
  console.log(`   - Tests analizados: ${testsWithWeakFocus?.length || 0}`);

  if (adaptiveTestsCount === 0) {
    console.log('\n❌ PROBLEMA DETECTADO:');
    console.log('   El modo adaptativo NO está siendo usado o NO se está guardando correctamente');
    console.log('\n🔍 POSIBLES CAUSAS:');
    console.log('   1. Los usuarios no están activando "Enfoque en áreas débiles" en TestConfigurator');
    console.log('   2. La configuración no se está pasando correctamente a fetchQuestionsByTopicScope');
    console.log('   3. El catálogo adaptativo no se está generando en testFetchers.js');
    console.log('\n💡 PASOS SIGUIENTES:');
    console.log('   1. Verificar que TestConfigurator tiene la opción focusWeakAreas visible');
    console.log('   2. Agregar console.logs en fetchQuestionsByTopicScope para ver si recibe focusWeakAreas');
    console.log('   3. Verificar que el catálogo adaptativo se está creando correctamente');
  } else {
    console.log('\n✅ El modo adaptativo está siendo usado');
    console.log('\n🔍 ANÁLISIS ADICIONAL NECESARIO:');
    console.log('   1. Verificar si las dificultades cambian durante el test');
    console.log('   2. Verificar si la lógica de adaptación en TestLayout se ejecuta');
    console.log('   3. Revisar logs del navegador para ver llamadas a adaptDifficulty()');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Investigación completada\n');
}

investigateAdaptiveMode().catch(error => {
  console.error('\n❌ ERROR FATAL:', error);
  process.exit(1);
});
