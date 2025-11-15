// scripts/debug-specific-question-classification.js
// Debuggear por qué una pregunta específica se clasifica mal

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function debugSpecificQuestionClassification() {
  console.log('🔍 DEBUG: PREGUNTA QUE APARECE COMO NUNCA VISTA PERO TIENE HISTORIAL');
  console.log('='.repeat(70));

  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const targetQuestionId = '27290fdb-3be5-4405-b666-8955e680d972'; // La que aparece en el test
  const tema = 1;

  try {
    // 1️⃣ VERIFICAR HISTORIAL EN test_questions 
    console.log('\n1️⃣ HISTORIAL EN test_questions (usado por algoritmo):');
    
    const { data: algorithmHistory, error: aError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tema_number,
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('tema_number', tema)
      .eq('questions.is_active', true)
      .eq('question_id', targetQuestionId);

    if (aError) {
      console.log('❌ Error algoritmo:', aError.message);
    } else {
      console.log(`📊 Registros algoritmo: ${algorithmHistory?.length || 0}`);
      algorithmHistory?.forEach((record, idx) => {
        console.log(`   ${idx + 1}. ${record.created_at} - Tema: ${record.tema_number}`);
      });
    }

    // 2️⃣ VERIFICAR HISTORIAL EN detailed_answers (usado por QuestionEvolution)
    console.log('\n2️⃣ HISTORIAL EN detailed_answers (QuestionEvolution):');
    
    const { data: evolutionHistory, error: eError } = await supabase
      .from('detailed_answers')
      .select('id, question_id, user_id, created_at, is_correct')
      .eq('user_id', userId)
      .eq('question_id', targetQuestionId)
      .order('created_at', { ascending: false });

    if (eError) {
      console.log('❌ Error evolution:', eError.message);
    } else {
      console.log(`📊 Registros evolution: ${evolutionHistory?.length || 0}`);
      evolutionHistory?.forEach((record, idx) => {
        console.log(`   ${idx + 1}. ${record.created_at} - Correcto: ${record.is_correct}`);
      });
    }

    // 3️⃣ VERIFICAR TODOS LOS REGISTROS EN test_questions SIN FILTROS
    console.log('\n3️⃣ TODOS LOS REGISTROS EN test_questions (sin filtros):');
    
    const { data: allTestQuestions, error: atqError } = await supabase
      .from('test_questions')
      .select('question_id, created_at, tema_number, test_id')
      .eq('question_id', targetQuestionId);

    if (atqError) {
      console.log('❌ Error all test questions:', atqError.message);
    } else {
      console.log(`📊 Total registros test_questions: ${allTestQuestions?.length || 0}`);
      allTestQuestions?.forEach((record, idx) => {
        console.log(`   ${idx + 1}. ${record.created_at} - Tema: ${record.tema_number} - Test: ${record.test_id}`);
      });
      
      // Verificar qué tests pertenecen al usuario
      if (allTestQuestions && allTestQuestions.length > 0) {
        const testIds = [...new Set(allTestQuestions.map(r => r.test_id))];
        const { data: userTests } = await supabase
          .from('tests')
          .select('id, user_id, created_at, tema_number')
          .in('id', testIds);

        console.log('\n📋 TESTS ASOCIADOS:');
        userTests?.forEach((test, idx) => {
          const isUserTest = test.user_id === userId;
          console.log(`   ${idx + 1}. ${test.id} - Usuario: ${isUserTest ? 'SÍ ✅' : 'NO ❌'} - Tema: ${test.tema_number}`);
        });
      }
    }

    // 4️⃣ REPRODUCIR EXACTAMENTE EL ALGORITMO
    console.log('\n4️⃣ REPRODUCIENDO ALGORITMO EXACTO:');
    
    // Query exacta del algoritmo
    const { data: exactAlgorithmQuery, error: eaqError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('tema_number', tema)
      .eq('questions.is_active', true)
      .order('created_at', { ascending: false });

    if (eaqError) {
      console.log('❌ Error exact algorithm:', eaqError.message);
    } else {
      console.log(`📊 Query algoritmo total: ${exactAlgorithmQuery?.length || 0} registros`);
      
      // Crear Set como hace el algoritmo
      const answeredQuestionIds = new Set();
      exactAlgorithmQuery?.forEach(answer => {
        answeredQuestionIds.add(answer.question_id);
      });
      
      console.log(`📊 Set de IDs respondidos: ${answeredQuestionIds.size} únicos`);
      console.log(`🎯 ¿Target question en Set?: ${answeredQuestionIds.has(targetQuestionId) ? 'SÍ ✅' : 'NO ❌'}`);
      
      if (!answeredQuestionIds.has(targetQuestionId)) {
        console.log('🚨 AQUÍ ESTÁ EL PROBLEMA: La pregunta NO está en el Set del algoritmo');
        console.log('   Pero SÍ tiene historial en detailed_answers');
        console.log('   Esto significa que el JOIN está fallando o hay inconsistencia de datos');
      }
    }

    // 5️⃣ VERIFICAR DISPONIBILIDAD EN PREGUNTAS DEL TEMA
    console.log('\n5️⃣ DISPONIBILIDAD EN PREGUNTAS DEL TEMA:');
    
    // Obtener mapeo del tema
    const { data: mappings } = await supabase
      .from('topic_scope')
      .select(`
        article_numbers,
        laws!inner(short_name, id),
        topics!inner(topic_number, position_type)
      `)
      .eq('topics.topic_number', tema)
      .eq('topics.position_type', 'auxiliar_administrativo');

    let isQuestionAvailable = false;
    if (mappings && mappings.length > 0) {
      for (const mapping of mappings) {
        if (!mapping.laws?.short_name) continue;

        const { data: questions } = await supabase
          .from('questions')
          .select('id, question_text, articles!inner(laws!inner(short_name))')
          .eq('is_active', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers)
          .eq('id', targetQuestionId);

        if (questions && questions.length > 0) {
          isQuestionAvailable = true;
          console.log(`✅ Pregunta disponible en ley: ${mapping.laws.short_name}`);
          break;
        }
      }
    }

    console.log(`🎯 ¿Pregunta disponible en tema ${tema}?: ${isQuestionAvailable ? 'SÍ ✅' : 'NO ❌'}`);

    // 6️⃣ DIAGNÓSTICO FINAL
    console.log('\n6️⃣ DIAGNÓSTICO:');
    
    const hasAlgorithmHistory = algorithmHistory && algorithmHistory.length > 0;
    const hasEvolutionHistory = evolutionHistory && evolutionHistory.length > 0;
    const inAlgorithmSet = exactAlgorithmQuery && exactAlgorithmQuery.some(q => q.question_id === targetQuestionId);

    console.log(`📊 RESUMEN:`);
    console.log(`   • Algoritmo detecta historial: ${hasAlgorithmHistory ? 'SÍ' : 'NO'}`);
    console.log(`   • QuestionEvolution detecta historial: ${hasEvolutionHistory ? 'SÍ' : 'NO'}`);
    console.log(`   • En Set del algoritmo: ${inAlgorithmSet ? 'SÍ' : 'NO'}`);
    console.log(`   • Disponible en tema: ${isQuestionAvailable ? 'SÍ' : 'NO'}`);

    if (!hasAlgorithmHistory && hasEvolutionHistory && isQuestionAvailable) {
      console.log('\n🚨 PROBLEMA ENCONTRADO:');
      console.log('   ❌ La pregunta tiene historial en detailed_answers');
      console.log('   ❌ Pero NO en test_questions para este tema/usuario');
      console.log('   ❌ Por eso el algoritmo la clasifica como "nunca vista"');
      console.log('   ❌ Pero QuestionEvolution la muestra como "repetida"');
      console.log('\n💡 POSIBLES CAUSAS:');
      console.log('   1. Inconsistencia entre test_questions y detailed_answers');
      console.log('   2. Problema en los JOINs del algoritmo');
      console.log('   3. Datos corruptos en las tablas');
      console.log('   4. La pregunta se respondió en otro tema/contexto');
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

debugSpecificQuestionClassification();