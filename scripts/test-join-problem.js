// scripts/test-join-problem.js
// Verificar el problema de INNER JOINs que excluyen registros válidos

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function testJoinProblem() {
  console.log('🔍 TESTANDO PROBLEMA DE INNER JOINS');
  console.log('='.repeat(50));

  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const tema = 1;

  try {
    // 1️⃣ QUERY SIMPLE SIN JOINS
    console.log('\n1️⃣ QUERY SIMPLE (sin JOINs):');
    
    const { data: simpleQuery, error: simpleError } = await supabase
      .from('test_questions')
      .select('question_id, created_at, tema_number, test_id')
      .eq('tema_number', tema);

    if (simpleError) {
      console.log('❌ Error simple query:', simpleError.message);
    } else {
      console.log(`   📊 Total registros tema ${tema}: ${simpleQuery?.length || 0}`);
      
      // Filtrar por user manualmente
      const userSpecificQuestions = simpleQuery?.filter(async (record) => {
        const { data: test } = await supabase
          .from('tests')
          .select('user_id')
          .eq('id', record.test_id)
          .single();
        return test?.user_id === userId;
      });
    }

    // 2️⃣ QUERY CON JOIN A TESTS
    console.log('\n2️⃣ QUERY CON JOIN a tests:');
    
    const { data: testsJoinQuery, error: testsJoinError } = await supabase
      .from('test_questions')
      .select(`
        question_id, created_at, tema_number,
        tests!inner(user_id)
      `)
      .eq('tema_number', tema)
      .eq('tests.user_id', userId);

    if (testsJoinError) {
      console.log('❌ Error tests join:', testsJoinError.message);
    } else {
      console.log(`   📊 Con JOIN tests: ${testsJoinQuery?.length || 0}`);
    }

    // 3️⃣ QUERY CON JOIN A TESTS Y QUESTIONS (la del algoritmo)
    console.log('\n3️⃣ QUERY CON DOBLE JOIN (algoritmo actual):');
    
    const { data: doubleJoinQuery, error: doubleJoinError } = await supabase
      .from('test_questions')
      .select(`
        question_id, created_at, tema_number,
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tema_number', tema)
      .eq('tests.user_id', userId)
      .eq('questions.is_active', true);

    if (doubleJoinError) {
      console.log('❌ Error double join:', doubleJoinError.message);
    } else {
      console.log(`   📊 Con JOIN tests + questions: ${doubleJoinQuery?.length || 0}`);
    }

    // 4️⃣ VERIFICAR ESTADO DE LAS QUESTIONS
    console.log('\n4️⃣ VERIFICANDO ESTADO DE LAS QUESTIONS:');
    
    // Obtener question_ids únicos del tema
    const uniqueQuestionIds = [...new Set(simpleQuery?.map(q => q.question_id) || [])];
    console.log(`   📊 Question IDs únicos en tema ${tema}: ${uniqueQuestionIds.length}`);
    
    if (uniqueQuestionIds.length > 0) {
      const { data: questionsStatus } = await supabase
        .from('questions')
        .select('id, is_active')
        .in('id', uniqueQuestionIds.slice(0, 10)); // Solo primeras 10 para test
      
      const activeQuestions = questionsStatus?.filter(q => q.is_active).length || 0;
      const inactiveQuestions = questionsStatus?.filter(q => !q.is_active).length || 0;
      
      console.log(`   ✅ Preguntas activas: ${activeQuestions}`);
      console.log(`   ❌ Preguntas inactivas: ${inactiveQuestions}`);
      
      if (inactiveQuestions > 0) {
        console.log('   🚨 PROBLEMA: Hay preguntas inactivas que el INNER JOIN excluye');
      }
    }

    // 5️⃣ VERIFICAR SPECIFIC QUESTION
    console.log('\n5️⃣ VERIFICANDO PREGUNTA ESPECÍFICA:');
    
    const targetQuestionId = '385ee94b-0d03-471e-baf3-8ee8dd18237b';
    
    // Estado de la pregunta
    const { data: targetQuestionStatus } = await supabase
      .from('questions')
      .select('id, is_active')
      .eq('id', targetQuestionId)
      .single();
    
    console.log(`   🎯 Pregunta ${targetQuestionId}:`);
    console.log(`   ✅ Existe: ${targetQuestionStatus ? 'SÍ' : 'NO'}`);
    console.log(`   ✅ Activa: ${targetQuestionStatus?.is_active}`);
    
    // Registros en test_questions
    const { data: targetRecords } = await supabase
      .from('test_questions')
      .select('question_id, created_at, tema_number, test_id')
      .eq('question_id', targetQuestionId)
      .eq('tema_number', tema);
    
    console.log(`   📊 Registros en test_questions tema ${tema}: ${targetRecords?.length || 0}`);
    
    if (targetRecords && targetRecords.length > 0) {
      // Verificar tests asociados
      const testIds = targetRecords.map(r => r.test_id);
      const { data: associatedTests } = await supabase
        .from('tests')
        .select('id, user_id')
        .in('id', testIds);
      
      const userTests = associatedTests?.filter(t => t.user_id === userId).length || 0;
      console.log(`   👤 Tests del usuario: ${userTests}`);
      
      // Test con JOIN a tests
      const { data: withTestsJoin } = await supabase
        .from('test_questions')
        .select(`
          question_id, tests!inner(user_id)
        `)
        .eq('question_id', targetQuestionId)
        .eq('tema_number', tema)
        .eq('tests.user_id', userId);
      
      console.log(`   🔗 Con JOIN tests: ${withTestsJoin?.length || 0}`);
      
      // Test con doble JOIN
      const { data: withDoubleJoin } = await supabase
        .from('test_questions')
        .select(`
          question_id, 
          tests!inner(user_id),
          questions!inner(is_active)
        `)
        .eq('question_id', targetQuestionId)
        .eq('tema_number', tema)
        .eq('tests.user_id', userId)
        .eq('questions.is_active', true);
      
      console.log(`   🔗 Con doble JOIN: ${withDoubleJoin?.length || 0}`);
      
      // DIAGNÓSTICO
      if (userTests > 0 && (withTestsJoin?.length || 0) === 0) {
        console.log('   🚨 PROBLEMA: JOIN a tests falla');
      } else if ((withTestsJoin?.length || 0) > 0 && (withDoubleJoin?.length || 0) === 0) {
        console.log('   🚨 PROBLEMA: JOIN a questions falla (pregunta inactiva?)');
      } else if ((withDoubleJoin?.length || 0) > 0) {
        console.log('   ✅ Los JOINs funcionan correctamente para esta pregunta');
      }
    }

    // 6️⃣ PROPUESTA DE FIX
    console.log('\n6️⃣ PROPUESTA DE FIX:');
    console.log('   🔧 OPCIÓN A: Usar LEFT JOIN en lugar de INNER JOIN');
    console.log('   🔧 OPCIÓN B: Separar la validación de is_active');
    console.log('   🔧 OPCIÓN C: Usar query simple + filtrado posterior');
    
    // Test con LEFT JOIN
    const { data: leftJoinTest, error: leftJoinError } = await supabase
      .from('test_questions')
      .select(`
        question_id, created_at, tema_number,
        tests!left(user_id),
        questions!left(is_active)
      `)
      .eq('tema_number', tema)
      .not('tests.user_id', 'is', null)
      .eq('tests.user_id', userId);

    if (leftJoinError) {
      console.log('   ❌ LEFT JOIN test failed:', leftJoinError.message);
    } else {
      // Filtrar solo activas
      const activeOnly = leftJoinTest?.filter(q => q.questions?.is_active === true) || [];
      console.log(`   ✅ LEFT JOIN resultado: ${activeOnly.length} preguntas activas`);
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

testJoinProblem();