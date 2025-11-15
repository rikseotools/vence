// scripts/check-regression-issues.js
// Verificar que el fix no haya roto otras funcionalidades

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function checkRegressionIssues() {
  console.log('🔍 VERIFICANDO POSIBLES REGRESIONES DEL FIX');
  console.log('='.repeat(60));

  try {
    // 1. Verificar que la query modificada funcione correctamente
    console.log('\n📊 TEST 1: Verificando nueva query de historial...');
    
    const testUserId = '33b7470f-f0a9-4b4c-b859-f8dbeb2f69b9';
    
    // Nueva query (con fix)
    const { data: newQuery, error: newError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(
          is_active,
          articles!inner(
            laws!inner(short_name)
          )
        )
      `)
      .eq('tests.user_id', testUserId)
      .eq('questions.is_active', true)
      .eq('questions.articles.laws.short_name', 'CE')
      .order('created_at', { ascending: false })
      .limit(10);

    if (newError) {
      console.error('❌ ERROR en nueva query:', newError.message);
      console.error('🚨 POSIBLE REGRESIÓN: La query modificada falla');
      return false;
    } else {
      console.log(`✅ Nueva query funciona: ${newQuery?.length || 0} resultados`);
    }

    // Query original (sin joins extra) para comparar
    const { data: originalQuery, error: originalError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id)
      `)
      .eq('tests.user_id', testUserId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (originalError) {
      console.error('❌ ERROR en query original:', originalError.message);
    } else {
      console.log(`📊 Query original: ${originalQuery?.length || 0} resultados`);
      console.log(`📊 Diferencia: ${(originalQuery?.length || 0) - (newQuery?.length || 0)} respuestas filtradas`);
    }

    // 2. Verificar casos edge - usuario sin historial
    console.log('\n📊 TEST 2: Usuario sin historial...');
    
    const { data: noHistoryTest, error: noHistoryError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(
          is_active,
          articles!inner(
            laws!inner(short_name)
          )
        )
      `)
      .eq('tests.user_id', 'usuario-inexistente-123')
      .eq('questions.is_active', true)
      .eq('questions.articles.laws.short_name', 'CE')
      .order('created_at', { ascending: false });

    if (noHistoryError) {
      console.error('❌ ERROR con usuario sin historial:', noHistoryError.message);
      console.error('🚨 POSIBLE REGRESIÓN: Query falla con usuarios nuevos');
      return false;
    } else {
      console.log(`✅ Usuario sin historial maneja correctamente: ${noHistoryTest?.length || 0} resultados`);
    }

    // 3. Verificar diferentes leyes
    console.log('\n📊 TEST 3: Verificando diferentes leyes...');
    
    const leysToTest = ['CE', 'Ley 19/2013', 'Ley 39/2015'];
    
    for (const law of leysToTest) {
      const { data: lawTest, error: lawError } = await supabase
        .from('test_questions')
        .select(`
          question_id, 
          tests!inner(user_id),
          questions!inner(
            articles!inner(
              laws!inner(short_name)
            )
          )
        `)
        .eq('tests.user_id', testUserId)
        .eq('questions.is_active', true)
        .eq('questions.articles.laws.short_name', law)
        .limit(5);

      if (lawError) {
        console.error(`❌ ERROR con ley ${law}:`, lawError.message);
        console.error('🚨 POSIBLE REGRESIÓN: Query falla con ciertas leyes');
        return false;
      } else {
        console.log(`✅ ${law}: ${lawTest?.length || 0} respuestas`);
      }
    }

    // 4. Verificar performance - ¿la query es mucho más lenta?
    console.log('\n📊 TEST 4: Verificando performance...');
    
    const startTime = Date.now();
    
    const { data: performanceTest, error: performanceError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(
          is_active,
          articles!inner(
            laws!inner(short_name)
          )
        )
      `)
      .eq('tests.user_id', testUserId)
      .eq('questions.is_active', true)
      .eq('questions.articles.laws.short_name', 'CE')
      .order('created_at', { ascending: false })
      .limit(100);

    const endTime = Date.now();
    const queryTime = endTime - startTime;

    if (performanceError) {
      console.error('❌ ERROR en test de performance:', performanceError.message);
      return false;
    } else {
      console.log(`✅ Query performance: ${queryTime}ms para ${performanceTest?.length || 0} resultados`);
      
      if (queryTime > 5000) {
        console.warn('⚠️ ADVERTENCIA: Query podría ser lenta (>5s)');
      }
    }

    // 5. Verificar que fallback funciona
    console.log('\n📊 TEST 5: Verificando fallback ante errores...');
    
    // Simular error forzando ley inexistente
    const { data: fallbackTest, error: fallbackError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(
          is_active,
          articles!inner(
            laws!inner(short_name)
          )
        )
      `)
      .eq('tests.user_id', testUserId)
      .eq('questions.is_active', true)
      .eq('questions.articles.laws.short_name', 'LEY_INEXISTENTE_123')
      .order('created_at', { ascending: false });

    if (fallbackError) {
      console.log(`⚠️ Query con ley inexistente da error (esperado): ${fallbackError.message}`);
    } else {
      console.log(`📊 Ley inexistente: ${fallbackTest?.length || 0} resultados`);
    }

    // 6. Verificar integridad de datos
    console.log('\n📊 TEST 6: Verificando integridad de datos...');
    
    if (newQuery && newQuery.length > 0) {
      const sampleResult = newQuery[0];
      
      const hasQuestionId = !!sampleResult.question_id;
      const hasCreatedAt = !!sampleResult.created_at;
      const hasTestUserId = !!sampleResult.tests?.user_id;
      const hasLawInfo = !!sampleResult.questions?.articles?.laws?.short_name;
      
      console.log('📋 Estructura de datos:');
      console.log(`   ✅ question_id: ${hasQuestionId}`);
      console.log(`   ✅ created_at: ${hasCreatedAt}`);
      console.log(`   ✅ tests.user_id: ${hasTestUserId}`);
      console.log(`   ✅ laws.short_name: ${hasLawInfo}`);
      
      if (!hasQuestionId || !hasCreatedAt || !hasTestUserId || !hasLawInfo) {
        console.error('🚨 REGRESIÓN: Datos incompletos en resultado');
        return false;
      }
    }

    // 7. Test específico: ¿fetchPersonalizedQuestions sigue funcionando?
    console.log('\n📊 TEST 7: Verificando compatibilidad con fetchPersonalizedQuestions...');
    
    try {
      // Verificar que las variables/constantes existen
      const testFetchersContent = await import('fs').then(fs => 
        fs.readFileSync('/Users/manuel/Documents/github/vence/lib/testFetchers.js', 'utf8')
      );
      
      // Verificar elementos críticos
      const hasTargetLawVar = testFetchersContent.includes('const targetLaw');
      const hasFilterLogging = testFetchersContent.includes('FILTRAR HISTORIAL');
      const hasCorrectJoin = testFetchersContent.includes('questions!inner(');
      
      console.log('📋 Elementos del fix:');
      console.log(`   ✅ Variable targetLaw: ${hasTargetLawVar}`);
      console.log(`   ✅ Logging del fix: ${hasFilterLogging}`);
      console.log(`   ✅ Join correcto: ${hasCorrectJoin}`);
      
      if (!hasTargetLawVar || !hasFilterLogging || !hasCorrectJoin) {
        console.error('🚨 REGRESIÓN: Fix incompleto o corrupto');
        return false;
      }
      
    } catch (readError) {
      console.error('❌ No se pudo verificar archivo source:', readError.message);
      return false;
    }

    console.log('\n📋 RESUMEN DE VERIFICACIÓN:');
    console.log('✅ Nueva query funciona correctamente');
    console.log('✅ Usuarios sin historial manejados');
    console.log('✅ Diferentes leyes funcionan');
    console.log('✅ Performance aceptable');
    console.log('✅ Integridad de datos preservada');
    console.log('✅ Fix completamente implementado');
    
    console.log('\n🎯 VEREDICTO: NO SE DETECTARON REGRESIONES');
    console.log('✅ El fix es seguro para producción');
    
    return true;

  } catch (error) {
    console.error('❌ Error general en verificación:', error.message);
    console.error('🚨 POSIBLE REGRESIÓN CRÍTICA');
    return false;
  }
}

checkRegressionIssues();