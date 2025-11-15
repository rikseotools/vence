// scripts/investigate-table-discrepancy.js
// Investigar discrepancia entre tabla psicotécnica y tabla normal

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function investigateTableDiscrepancy() {
  console.log('🔍 INVESTIGANDO DISCREPANCIA ENTRE TABLAS');
  console.log('='.repeat(60));

  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const targetQuestionId = '385ee94b-0d03-471e-baf3-8ee8dd18237b';

  try {
    // 1️⃣ VERIFICAR TABLA DE TESTS NORMALES (test_questions)
    console.log('\n1️⃣ TABLA test_questions (usada por fetchQuestionsByTopicScope):');
    
    const { data: testQuestions, error: testError } = await supabase
      .from('test_questions')
      .select(`
        question_id, created_at, tema_number,
        tests!inner(user_id)
      `)
      .eq('tests.user_id', userId)
      .eq('question_id', targetQuestionId);

    if (testError) {
      console.log('❌ Error:', testError.message);
    } else {
      console.log(`📊 Registros en test_questions: ${testQuestions?.length || 0}`);
      if (testQuestions && testQuestions.length > 0) {
        testQuestions.forEach((record, idx) => {
          console.log(`   ${idx + 1}. Tema: ${record.tema_number} - Fecha: ${record.created_at}`);
        });
      }
    }

    // 2️⃣ VERIFICAR TABLA PSICOTÉCNICA (psychometric_test_answers) 
    console.log('\n2️⃣ TABLA psychometric_test_answers (usada por selectAdaptiveQuestions):');
    
    const { data: psychometricAnswers, error: psychError } = await supabase
      .from('psychometric_test_answers')
      .select('question_id, created_at, is_correct, user_id')
      .eq('user_id', userId)
      .eq('question_id', targetQuestionId);

    if (psychError) {
      console.log('❌ Error:', psychError.message);
    } else {
      console.log(`📊 Registros en psychometric_test_answers: ${psychometricAnswers?.length || 0}`);
      if (psychometricAnswers && psychometricAnswers.length > 0) {
        psychometricAnswers.forEach((record, idx) => {
          console.log(`   ${idx + 1}. Correcta: ${record.is_correct} - Fecha: ${record.created_at}`);
        });
      }
    }

    // 3️⃣ VERIFICAR QUÉ PÁGINA ESTÁ USANDO EL USUARIO
    console.log('\n3️⃣ ANÁLISIS DE LA DISCREPANCIA:');
    
    const hasTestData = testQuestions && testQuestions.length > 0;
    const hasPsychometricData = psychometricAnswers && psychometricAnswers.length > 0;
    
    console.log(`📊 RESUMEN:`);
    console.log(`   • test_questions: ${hasTestData ? 'TIENE datos' : 'NO tiene datos'}`);
    console.log(`   • psychometric_test_answers: ${hasPsychometricData ? 'TIENE datos' : 'NO tiene datos'}`);
    
    if (hasTestData && !hasPsychometricData) {
      console.log('\n🎯 DIAGNÓSTICO:');
      console.log('✅ La pregunta está en test_questions (tests normales)');
      console.log('❌ La pregunta NO está en psychometric_test_answers');
      console.log('🔍 POSIBLE CAUSA: Usuario está en página tema normal, pero algoritmo está usando lógica psicotécnica');
      
    } else if (!hasTestData && hasPsychometricData) {
      console.log('\n🎯 DIAGNÓSTICO:');
      console.log('❌ La pregunta NO está en test_questions');
      console.log('✅ La pregunta está en psychometric_test_answers');
      console.log('🔍 POSIBLE CAUSA: Usuario está en página psicotécnica, fetchQuestionsByTopicScope no encuentra historial');
      
    } else if (hasTestData && hasPsychometricData) {
      console.log('\n🎯 DIAGNÓSTICO:');
      console.log('✅ La pregunta está en AMBAS tablas');
      console.log('🔍 Ambos sistemas deberían funcionar correctamente');
      
    } else {
      console.log('\n🎯 DIAGNÓSTICO:');
      console.log('❌ La pregunta NO está en ninguna tabla');
      console.log('🔍 El usuario nunca ha respondido esta pregunta');
    }

    // 4️⃣ VERIFICAR TIPO DE PREGUNTA
    console.log('\n4️⃣ VERIFICANDO TIPO DE PREGUNTA:');
    
    const { data: questionInfo, error: qError } = await supabase
      .from('questions')
      .select(`
        id, question_text, 
        articles(article_number, laws(short_name))
      `)
      .eq('id', targetQuestionId)
      .single();

    if (qError || !questionInfo) {
      console.log('❌ Error obteniendo info pregunta:', qError?.message);
    } else {
      console.log(`📄 Pregunta: ${questionInfo.question_text.substring(0, 80)}...`);
      console.log(`📚 Ley: ${questionInfo.articles?.laws?.short_name}`);
      console.log(`📄 Artículo: ${questionInfo.articles?.article_number}`);
      
      const isConstitution = questionInfo.articles?.laws?.short_name === 'CE';
      console.log(`🎯 ¿Es Constitución?: ${isConstitution ? 'SÍ ✅' : 'NO ❌'}`);
    }

    // 5️⃣ VERIFICAR EN QUÉ TABLA psychometric_questions
    console.log('\n5️⃣ VERIFICANDO SI ES PREGUNTA PSICOTÉCNICA:');
    
    const { data: psychometricQuestion, error: psyqError } = await supabase
      .from('psychometric_questions')
      .select('id, question_text')
      .eq('id', targetQuestionId)
      .single();

    if (psyqError) {
      console.log(`❌ No encontrada en psychometric_questions: ${psyqError.message}`);
      console.log('✅ Es una pregunta NORMAL de legislación');
      console.log('🎯 DEBERÍA usar fetchQuestionsByTopicScope y tabla test_questions');
    } else {
      console.log('✅ Encontrada en psychometric_questions');
      console.log(`📄 Texto psico: ${psychometricQuestion.question_text.substring(0, 80)}...`);
      console.log('🎯 DEBERÍA usar selectAdaptiveQuestions y tabla psychometric_test_answers');
    }

    // 6️⃣ BUSCAR PATRONES EN USER LOGS
    console.log('\n6️⃣ CONCLUSIONES:');
    
    if (hasTestData && !hasPsychometricData) {
      console.log('🚨 PROBLEMA IDENTIFICADO:');
      console.log('   • La pregunta tiene historial en tests normales');
      console.log('   • Pero QuestionEvolution la muestra como vista');
      console.log('   • Y aún así el usuario la ve repetida');
      console.log('   📋 POSIBLES CAUSAS:');
      console.log('     1. Página está mezclando lógicas psicotécnica y normal');
      console.log('     2. Cache del navegador');
      console.log('     3. Diferentes fetchers ejecutándose');
      console.log('     4. Estado inconsistente entre componentes');
    }

    // 7️⃣ VERIFICAR SI HAY OTRAS PREGUNTAS CON EL MISMO PATRÓN
    console.log('\n7️⃣ VERIFICANDO PATRONES SIMILARES:');
    
    const { data: allUserQuestions } = await supabase
      .from('test_questions')
      .select('question_id')
      .eq('tests.user_id', userId)
      .eq('tema_number', 1);

    if (allUserQuestions && allUserQuestions.length > 0) {
      const questionIds = allUserQuestions.map(q => q.question_id);
      
      // Ver cuántas de estas también están en psychometric
      const { data: psychometricMatches } = await supabase
        .from('psychometric_test_answers')
        .select('question_id')
        .eq('user_id', userId)
        .in('question_id', questionIds.slice(0, 10)); // Muestra de 10

      console.log(`📊 Muestra de 10 preguntas del tema 1:`);
      console.log(`   • En test_questions: 10`);
      console.log(`   • También en psychometric: ${psychometricMatches?.length || 0}`);
      
      if ((psychometricMatches?.length || 0) > 0) {
        console.log('🔍 HAY OVERLAP entre ambas tablas');
      } else {
        console.log('🔍 NO hay overlap - son sistemas separados');
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

investigateTableDiscrepancy();