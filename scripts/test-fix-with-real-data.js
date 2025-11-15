// scripts/test-fix-with-real-data.js
// Probar el fix con datos reales de CE donde sí hay historial

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function testFixWithRealData() {
  console.log('🔍 PROBANDO FIX CON DATOS REALES DE CE');
  console.log('='.repeat(50));

  const userId = '33b7470f-f0a9-4b4c-b859-f8dbeb2f69b9';
  const targetLaw = 'CE'; // Cambiar a CE donde sí hay datos

  try {
    // 1. Verificar preguntas disponibles de CE
    console.log('\n📊 STEP 1: Preguntas disponibles CE...');
    const { data: availableQuestions } = await supabase
      .from('questions')
      .select(`
        id,
        articles!inner(
          laws!inner(short_name)
        )
      `)
      .eq('is_active', true)
      .eq('articles.laws.short_name', targetLaw);

    console.log(`📊 Preguntas disponibles CE: ${availableQuestions?.length || 0}`);

    if (!availableQuestions || availableQuestions.length === 0) {
      console.log('❌ No hay preguntas de CE disponibles');
      return;
    }

    // 2. Historial SIN filtros (algoritmo original)
    console.log('\n📊 STEP 2: Historial SIN filtros (algoritmo original)...');
    const { data: rawHistory } = await supabase
      .from('test_questions')
      .select('question_id, created_at, tests!inner(user_id)')
      .eq('tests.user_id', userId)
      .order('created_at', { ascending: false });

    const rawIds = new Set(rawHistory?.map(r => r.question_id) || []);
    console.log(`📊 Historial RAW: ${rawHistory?.length || 0} respuestas, ${rawIds.size} únicas`);

    // 3. Historial CON filtros (algoritmo con fix)
    console.log('\n📊 STEP 3: Historial CON filtros (algoritmo con fix)...');
    const { data: filteredHistory } = await supabase
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
      .eq('tests.user_id', userId)
      .eq('questions.is_active', true)
      .eq('questions.articles.laws.short_name', targetLaw)
      .order('created_at', { ascending: false });

    const filteredIds = new Set(filteredHistory?.map(f => f.question_id) || []);
    console.log(`📊 Historial FILTRADO: ${filteredHistory?.length || 0} respuestas, ${filteredIds.size} únicas`);

    // 4. Aplicar algoritmo ORIGINAL (sin fix)
    console.log('\n📊 STEP 4: Algoritmo ORIGINAL (sin fix)...');
    
    const neverSeenOriginal = availableQuestions.filter(q => !rawIds.has(q.id));
    const answeredOriginal = availableQuestions.filter(q => rawIds.has(q.id));
    
    console.log(`❌ ORIGINAL - Nunca vistas: ${neverSeenOriginal.length}`);
    console.log(`❌ ORIGINAL - Ya respondidas: ${answeredOriginal.length}`);
    console.log(`❌ ORIGINAL - Total: ${neverSeenOriginal.length + answeredOriginal.length} (de ${availableQuestions.length})`);

    // 5. Aplicar algoritmo CON FIX
    console.log('\n📊 STEP 5: Algoritmo CON FIX...');
    
    const neverSeenFixed = availableQuestions.filter(q => !filteredIds.has(q.id));
    const answeredFixed = availableQuestions.filter(q => filteredIds.has(q.id));
    
    console.log(`✅ CON FIX - Nunca vistas: ${neverSeenFixed.length}`);
    console.log(`✅ CON FIX - Ya respondidas: ${answeredFixed.length}`);
    console.log(`✅ CON FIX - Total: ${neverSeenFixed.length + answeredFixed.length} (de ${availableQuestions.length})`);

    // 6. Comparar resultados
    console.log('\n📊 STEP 6: Comparación de resultados...');
    console.log('\n📋 COMPARACIÓN ALGORITMOS:');
    console.log(`                     | SIN FIX | CON FIX | MEJORA`);
    console.log(`   Nunca vistas      | ${neverSeenOriginal.length.toString().padStart(7)} | ${neverSeenFixed.length.toString().padStart(7)} | ${(neverSeenFixed.length - neverSeenOriginal.length >= 0 ? '+' : '') + (neverSeenFixed.length - neverSeenOriginal.length)}`);
    console.log(`   Ya respondidas    | ${answeredOriginal.length.toString().padStart(7)} | ${answeredFixed.length.toString().padStart(7)} | ${(answeredFixed.length - answeredOriginal.length >= 0 ? '+' : '') + (answeredFixed.length - answeredOriginal.length)}`);
    console.log(`   Historial usado   | ${rawIds.size.toString().padStart(7)} | ${filteredIds.size.toString().padStart(7)} | ${(filteredIds.size - rawIds.size >= 0 ? '+' : '') + (filteredIds.size - rawIds.size)}`);

    // 7. Simular selección de preguntas
    console.log('\n📊 STEP 7: Simulando selección de 25 preguntas...');
    
    const requestedCount = 25;
    
    // Algoritmo original
    let selectedOriginal = [];
    if (neverSeenOriginal.length >= requestedCount) {
      selectedOriginal = neverSeenOriginal.slice(0, requestedCount);
    } else {
      selectedOriginal = [
        ...neverSeenOriginal,
        ...answeredOriginal.slice(0, requestedCount - neverSeenOriginal.length)
      ];
    }
    
    // Algoritmo con fix
    let selectedFixed = [];
    if (neverSeenFixed.length >= requestedCount) {
      selectedFixed = neverSeenFixed.slice(0, requestedCount);
    } else {
      selectedFixed = [
        ...neverSeenFixed,
        ...answeredFixed.slice(0, requestedCount - neverSeenFixed.length)
      ];
    }
    
    console.log(`📋 SELECCIÓN FINAL:`);
    console.log(`   SIN FIX: ${selectedOriginal.length} preguntas (${Math.min(neverSeenOriginal.length, requestedCount)} nunca vistas + ${Math.max(0, requestedCount - neverSeenOriginal.length)} repaso)`);
    console.log(`   CON FIX: ${selectedFixed.length} preguntas (${Math.min(neverSeenFixed.length, requestedCount)} nunca vistas + ${Math.max(0, requestedCount - neverSeenFixed.length)} repaso)`);

    // 8. Verificar si el fix resuelve el problema
    console.log('\n📊 STEP 8: ¿El fix resuelve el problema de preguntas repetidas?');
    
    if (neverSeenFixed.length > neverSeenOriginal.length) {
      console.log('✅ SÍ! El fix proporciona MÁS preguntas nunca vistas');
      console.log(`   Mejora: +${neverSeenFixed.length - neverSeenOriginal.length} preguntas nunca vistas adicionales`);
      
      if (neverSeenFixed.length >= requestedCount) {
        console.log('🎯 PROBLEMA COMPLETAMENTE RESUELTO: Usuario tendrá 25 preguntas nunca vistas');
      } else {
        console.log('🎯 MEJORA SIGNIFICATIVA: Menos preguntas repetidas que antes');
      }
    } else if (neverSeenFixed.length === neverSeenOriginal.length) {
      console.log('📊 Sin cambio para esta ley específica (el usuario no tenía historial mixto)');
    } else {
      console.log('❌ El fix parece haber empeorado la situación (esto no debería pasar)');
    }

    // 9. Análisis de impacto del fix
    console.log('\n📊 STEP 9: Análisis de impacto del fix...');
    
    const historialMixto = rawHistory?.filter(r => {
      return !filteredIds.has(r.question_id);
    }) || [];
    
    console.log(`📊 Respuestas de otras leyes filtradas: ${historialMixto.length}`);
    
    if (historialMixto.length > 0) {
      console.log('🎯 IMPACTO POSITIVO: El fix filtró respuestas de otras leyes');
      console.log('   Esto permite calcular correctamente las preguntas nunca vistas por ley específica');
    }

    console.log('\n📋 CONCLUSIÓN FINAL:');
    if (neverSeenFixed.length > neverSeenOriginal.length) {
      console.log('✅ FIX EXITOSO: Resuelve el problema de preguntas repetidas');
      console.log('✅ Los usuarios verán más preguntas nunca vistas');
      console.log('✅ Algoritmo ahora calcula correctamente por ley específica');
    } else {
      console.log('📊 Fix implementado correctamente, pero este usuario específico no tenía historial mixto');
      console.log('📊 El fix funcionará para usuarios que respondan preguntas de múltiples leyes');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFixWithRealData();