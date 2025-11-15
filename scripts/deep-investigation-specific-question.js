// scripts/deep-investigation-specific-question.js
// Investigación profunda de la pregunta específica que aparece como "nunca vista" cuando tiene historial

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function deepInvestigation() {
  console.log('🔍 INVESTIGACIÓN PROFUNDA DE LA DISCREPANCIA');
  console.log('='.repeat(70));

  const targetQuestionId = '385ee94b-0d03-471e-baf3-8ee8dd18237b';
  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const tema = 1;

  try {
    // 1️⃣ INFORMACIÓN BÁSICA DE LA PREGUNTA
    console.log(`\n1️⃣ INFORMACIÓN BÁSICA DE LA PREGUNTA:`);
    console.log(`   🎯 Question ID: ${targetQuestionId}`);
    console.log(`   👤 User ID: ${userId}`);
    console.log(`   📚 Tema: ${tema}`);

    const { data: questionInfo, error: qError } = await supabase
      .from('questions')
      .select(`
        id, question_text, is_active, created_at,
        articles!inner(
          article_number,
          laws!inner(short_name)
        )
      `)
      .eq('id', targetQuestionId)
      .single();

    if (qError || !questionInfo) {
      console.log('❌ Error obteniendo info de pregunta:', qError?.message);
      return;
    }

    console.log(`   📄 Texto: ${questionInfo.question_text.substring(0, 100)}...`);
    console.log(`   ✅ Activa: ${questionInfo.is_active}`);
    console.log(`   📅 Creada: ${questionInfo.created_at}`);
    console.log(`   📚 Ley: ${questionInfo.articles?.laws?.short_name}`);
    console.log(`   📄 Artículo: ${questionInfo.articles?.article_number}`);

    // 2️⃣ QUERY EXACTA DEL ALGORITMO (fetchQuestionsByTopicScope)
    console.log(`\n2️⃣ QUERY EXACTA DEL ALGORITMO:`);
    
    const { data: algorithmHistory, error: aError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('tema_number', tema)  // 🔑 FILTRO POR TEMA
      .eq('questions.is_active', true)
      .order('created_at', { ascending: false });

    if (aError) {
      console.log('❌ Error en query algoritmo:', aError.message);
    } else {
      console.log(`   📊 Total respuestas algoritmo: ${algorithmHistory?.length || 0}`);
      
      const targetInAlgorithm = algorithmHistory?.find(h => h.question_id === targetQuestionId);
      console.log(`   🎯 ¿Pregunta en historial algoritmo?: ${targetInAlgorithm ? 'SÍ ✅' : 'NO ❌'}`);
      
      if (targetInAlgorithm) {
        console.log(`   📅 Fecha respuesta algoritmo: ${targetInAlgorithm.created_at}`);
      }
    }

    // 3️⃣ QUERY DE QUESTIONEVOLUTION (la que muestra 3 intentos)
    console.log(`\n3️⃣ QUERY DE QUESTIONEVOLUTION:`);
    
    const { data: evolutionHistory, error: eError } = await supabase
      .from('test_questions')
      .select(`
        id, question_id, selected_option, is_correct, created_at, tema_number,
        tests!inner(user_id)
      `)
      .eq('tests.user_id', userId)
      .eq('question_id', targetQuestionId)
      .order('created_at', { ascending: false });

    if (eError) {
      console.log('❌ Error en query evolution:', eError.message);
    } else {
      console.log(`   📊 Total intentos evolution: ${evolutionHistory?.length || 0}`);
      
      if (evolutionHistory && evolutionHistory.length > 0) {
        console.log(`   📋 DETALLES DE LOS INTENTOS:`);
        evolutionHistory.forEach((attempt, idx) => {
          console.log(`      ${idx + 1}. ${attempt.created_at} - Tema: ${attempt.tema_number} - Correcta: ${attempt.is_correct} - Opción: ${attempt.selected_option}`);
        });
        
        // Verificar si algún intento es del tema 1
        const tema1Attempts = evolutionHistory.filter(a => a.tema_number === tema);
        console.log(`   🎯 Intentos específicos tema ${tema}: ${tema1Attempts.length}`);
        
        if (tema1Attempts.length > 0) {
          console.log(`   📋 INTENTOS TEMA ${tema}:`);
          tema1Attempts.forEach((attempt, idx) => {
            console.log(`      ${idx + 1}. ${attempt.created_at} - Correcta: ${attempt.is_correct}`);
          });
        }
      }
    }

    // 4️⃣ COMPARACIÓN DIRECTA DE QUERIES
    console.log(`\n4️⃣ COMPARACIÓN DIRECTA:`);
    
    // Query algoritmo simplificada para esta pregunta específica
    const { data: algorithmSpecific } = await supabase
      .from('test_questions')
      .select('question_id, created_at, tema_number')
      .eq('tests.user_id', userId)
      .eq('tema_number', tema)
      .eq('question_id', targetQuestionId);

    // Query sin filtro de tema
    const { data: globalHistory } = await supabase
      .from('test_questions')  
      .select('question_id, created_at, tema_number')
      .eq('tests.user_id', userId)
      .eq('question_id', targetQuestionId);

    console.log(`   📊 Con filtro tema ${tema}: ${algorithmSpecific?.length || 0} resultados`);
    console.log(`   📊 Sin filtro tema: ${globalHistory?.length || 0} resultados`);

    if (algorithmSpecific?.length > 0) {
      console.log(`   ✅ LA PREGUNTA SÍ ESTÁ EN HISTORIAL CON FILTRO TEMA ${tema}`);
      algorithmSpecific.forEach(record => {
        console.log(`      📅 ${record.created_at} - Tema: ${record.tema_number}`);
      });
    } else {
      console.log(`   ❌ LA PREGUNTA NO ESTÁ EN HISTORIAL CON FILTRO TEMA ${tema}`);
    }

    if (globalHistory?.length > 0) {
      console.log(`   📋 HISTORIAL GLOBAL DE ESTA PREGUNTA:`);
      globalHistory.forEach(record => {
        console.log(`      📅 ${record.created_at} - Tema: ${record.tema_number}`);
      });
    }

    // 5️⃣ VERIFICAR DATOS DE LA TABLA TEST_QUESTIONS
    console.log(`\n5️⃣ VERIFICACIÓN TABLA TEST_QUESTIONS:`);
    
    const { data: rawTestQuestions } = await supabase
      .from('test_questions')
      .select('*')
      .eq('question_id', targetQuestionId)
      .order('created_at', { ascending: false });

    if (rawTestQuestions && rawTestQuestions.length > 0) {
      console.log(`   📊 Total registros en test_questions: ${rawTestQuestions.length}`);
      console.log(`   📋 TODOS LOS REGISTROS:`);
      
      rawTestQuestions.forEach((record, idx) => {
        console.log(`      ${idx + 1}. Test ID: ${record.test_id}`);
        console.log(`         📅 Fecha: ${record.created_at}`);
        console.log(`         📚 Tema: ${record.tema_number}`);
        console.log(`         ✅ Opción: ${record.selected_option}`);
        console.log(`         🎯 Correcta: ${record.is_correct}`);
        console.log('');
      });

      // Verificar si hay registros del tema 1
      const tema1Records = rawTestQuestions.filter(r => r.tema_number === tema);
      console.log(`   🎯 Registros específicos tema ${tema}: ${tema1Records.length}`);
    }

    // 6️⃣ VERIFICAR TABLA TESTS ASOCIADA
    console.log(`\n6️⃣ VERIFICACIÓN TABLA TESTS:`);
    
    if (rawTestQuestions && rawTestQuestions.length > 0) {
      const testIds = rawTestQuestions.map(r => r.test_id);
      
      const { data: testsInfo } = await supabase
        .from('tests')
        .select('*')
        .in('id', testIds)
        .eq('user_id', userId);

      if (testsInfo && testsInfo.length > 0) {
        console.log(`   📊 Tests asociados: ${testsInfo.length}`);
        testsInfo.forEach((test, idx) => {
          console.log(`      ${idx + 1}. Test ID: ${test.id}`);
          console.log(`         👤 User ID: ${test.user_id}`);
          console.log(`         📅 Creado: ${test.created_at}`);
          console.log(`         📚 Tema: ${test.tema_number}`);
          console.log(`         🎯 Tipo: ${test.test_type}`);
          console.log('');
        });

        // Verificar consistencia de user_id
        const wrongUser = testsInfo.filter(t => t.user_id !== userId);
        if (wrongUser.length > 0) {
          console.log(`   ❌ INCONSISTENCIA: ${wrongUser.length} tests con user_id incorrecto`);
        } else {
          console.log(`   ✅ Todos los tests tienen el user_id correcto`);
        }
      }
    }

    // 7️⃣ SIMULACIÓN DEL ALGORITMO PARA ESTA PREGUNTA
    console.log(`\n7️⃣ SIMULACIÓN DEL ALGORITMO:`);
    
    // Obtener todas las preguntas disponibles para tema 1
    const { data: mappings } = await supabase
      .from('topic_scope')
      .select(`
        article_numbers,
        laws!inner(short_name, id),
        topics!inner(topic_number, position_type)
      `)
      .eq('topics.topic_number', tema)
      .eq('topics.position_type', 'auxiliar_administrativo');

    let allAvailableQuestions = [];
    if (mappings) {
      for (const mapping of mappings) {
        if (!mapping.laws?.short_name) continue;

        const { data: questions } = await supabase
          .from('questions')
          .select('id, question_text, articles!inner(laws!inner(short_name))')
          .eq('is_active', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers);

        if (questions) {
          allAvailableQuestions = [...allAvailableQuestions, ...questions];
        }
      }
    }

    const targetInAvailable = allAvailableQuestions.find(q => q.id === targetQuestionId);
    console.log(`   🎯 ¿Pregunta en disponibles para tema?: ${targetInAvailable ? 'SÍ ✅' : 'NO ❌'}`);

    if (targetInAvailable && algorithmHistory) {
      const answeredIds = new Set(algorithmHistory.map(ua => ua.question_id));
      const isAnswered = answeredIds.has(targetQuestionId);
      console.log(`   🎯 ¿Pregunta en historial algoritmo?: ${isAnswered ? 'SÍ ✅' : 'NO ❌'}`);
      
      console.log(`\n   📊 CLASIFICACIÓN DEL ALGORITMO:`);
      if (isAnswered) {
        console.log(`      📚 CLASIFICADA COMO: Ya respondida`);
        console.log(`      📊 Iría a: answeredQuestions array`);
      } else {
        console.log(`      👁️ CLASIFICADA COMO: Nunca vista`);
        console.log(`      📊 Iría a: neverSeenQuestions array`);
      }
    }

    // 8️⃣ DIAGNÓSTICO FINAL
    console.log(`\n8️⃣ DIAGNÓSTICO FINAL:`);
    
    const hasGlobalHistory = globalHistory && globalHistory.length > 0;
    const hasTemaHistory = algorithmSpecific && algorithmSpecific.length > 0;
    const isInAvailable = !!targetInAvailable;
    
    console.log(`   📊 RESUMEN:`);
    console.log(`   • Pregunta tiene historial global: ${hasGlobalHistory ? 'SÍ' : 'NO'}`);
    console.log(`   • Pregunta tiene historial tema ${tema}: ${hasTemaHistory ? 'SÍ' : 'NO'}`);
    console.log(`   • Pregunta disponible para tema ${tema}: ${isInAvailable ? 'SÍ' : 'NO'}`);
    
    if (hasGlobalHistory && !hasTemaHistory && isInAvailable) {
      console.log(`\n   🎯 EXPLICACIÓN DE LA DISCREPANCIA:`);
      console.log(`   ✅ La pregunta fue respondida en otros temas, NO en tema ${tema}`);
      console.log(`   ✅ Por eso QuestionEvolution la muestra como respondida`);
      console.log(`   ✅ Pero el algoritmo la considera "nunca vista" para tema ${tema}`);
      console.log(`   ✅ ESTO ES EL COMPORTAMIENTO CORRECTO`);
    } else if (!hasGlobalHistory) {
      console.log(`\n   ❌ PROBLEMA: No hay historial global pero sí aparece en QuestionEvolution`);
    } else if (hasTemaHistory) {
      console.log(`\n   ❌ PROBLEMA: Hay historial tema ${tema} pero algoritmo no lo detecta`);
    } else {
      console.log(`\n   ❓ NECESITA MÁS INVESTIGACIÓN`);
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

deepInvestigation();