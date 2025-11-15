// scripts/debug-deep-inconsistency.js
// Análisis profundo de la inconsistencia detectada

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function debugDeepInconsistency() {
  console.log('🔍 ANÁLISIS PROFUNDO DE INCONSISTENCIA DETECTADA');
  console.log('='.repeat(60));

  const userId = '33b7470f-f0a9-4b4c-b859-f8dbeb2f69b9';

  try {
    // 1. Analizar el historial crudo vs filtrado
    console.log('\n📊 STEP 1: Comparando historial RAW vs FILTRADO...');
    
    // Query RAW sin filtros
    const { data: rawHistory } = await supabase
      .from('test_questions')
      .select('question_id, created_at, tests!inner(user_id)')
      .eq('tests.user_id', userId)
      .order('created_at', { ascending: false });

    console.log(`📊 Historial RAW: ${rawHistory?.length || 0} respuestas`);
    
    // Query con filtros (simulando fetchPersonalizedQuestions)
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
      .eq('questions.articles.laws.short_name', 'Ley 19/2013')
      .order('created_at', { ascending: false });

    console.log(`📊 Historial FILTRADO: ${filteredHistory?.length || 0} respuestas`);
    console.log(`📊 Diferencia: ${(rawHistory?.length || 0) - (filteredHistory?.length || 0)} respuestas filtradas`);

    if (rawHistory && filteredHistory) {
      const rawIds = rawHistory.map(r => r.question_id);
      const filteredIds = filteredHistory.map(f => f.question_id);
      
      const rawSet = new Set(rawIds);
      const filteredSet = new Set(filteredIds);
      
      console.log(`📊 IDs únicos RAW: ${rawSet.size}`);
      console.log(`📊 IDs únicos FILTRADOS: ${filteredSet.size}`);
      
      // Encontrar qué se filtró
      const removedIds = rawIds.filter(id => !filteredSet.has(id));
      if (removedIds.length > 0) {
        console.log(`📝 IDs removidos por filtros: ${removedIds.slice(0, 5).join(', ')}`);
        
        // Analizar por qué se removieron
        for (const removedId of removedIds.slice(0, 3)) {
          const { data: questionDetails } = await supabase
            .from('questions')
            .select(`
              id, is_active,
              articles(
                laws(short_name)
              )
            `)
            .eq('id', removedId)
            .single();

          if (questionDetails) {
            console.log(`   ${removedId}:`);
            console.log(`     - Activa: ${questionDetails.is_active}`);
            console.log(`     - Ley: ${questionDetails.articles?.laws?.short_name || 'N/A'}`);
          } else {
            console.log(`   ${removedId}: ❌ No existe en tabla questions`);
          }
        }
      }
    }

    // 2. Verificar las preguntas disponibles reales
    console.log('\n📊 STEP 2: Verificando preguntas disponibles reales...');
    
    const { data: availableQuestions } = await supabase
      .from('questions')
      .select(`
        id,
        articles!inner(
          laws!inner(short_name)
        )
      `)
      .eq('articles.laws.short_name', 'Ley 19/2013')
      .eq('is_active', true);
    
    console.log(`📊 Preguntas disponibles: ${availableQuestions?.length || 0}`);

    // 3. Reproducir exactamente el algoritmo de fetchPersonalizedQuestions
    console.log('\n📊 STEP 3: Reproduciendo algoritmo EXACTO...');
    
    if (availableQuestions && filteredHistory) {
      // Esto es exactamente lo que hace fetchPersonalizedQuestions
      const answeredQuestionIds = new Set(filteredHistory.map(ua => ua.question_id));
      const neverSeenQuestions = availableQuestions.filter(q => !answeredQuestionIds.has(q.id));
      const alreadyAnswered = availableQuestions.filter(q => answeredQuestionIds.has(q.id));
      
      console.log(`📊 IDs únicos en historial filtrado: ${answeredQuestionIds.size}`);
      console.log(`📊 Nunca vistas calculadas: ${neverSeenQuestions.length}`);
      console.log(`📊 Ya respondidas calculadas: ${alreadyAnswered.length}`);
      console.log(`📊 Total verificación: ${neverSeenQuestions.length + alreadyAnswered.length}`);
      
      // ¿La suma cuadra?
      if (neverSeenQuestions.length + alreadyAnswered.length !== availableQuestions.length) {
        console.log('🚨 PROBLEMA: La suma no cuadra!');
        
        // Buscar el problema
        const neverSeenIds = new Set(neverSeenQuestions.map(q => q.id));
        const alreadyAnsweredIds = new Set(alreadyAnswered.map(q => q.id));
        
        const missingQuestions = availableQuestions.filter(q => 
          !neverSeenIds.has(q.id) && !alreadyAnsweredIds.has(q.id)
        );
        
        console.log(`📊 Preguntas perdidas: ${missingQuestions.length}`);
        if (missingQuestions.length > 0) {
          console.log('📝 Ejemplo de pregunta perdida:');
          const lost = missingQuestions[0];
          console.log(`   ID: ${lost.id}`);
          console.log(`   En historial: ${answeredQuestionIds.has(lost.id)}`);
          console.log(`   En disponibles: ${availableQuestions.some(q => q.id === lost.id)}`);
        }
      }
      
      // 4. Test crítico: ¿Qué devolvería fetchPersonalizedQuestions?
      console.log('\n📊 STEP 4: Simulando fetchPersonalizedQuestions...');
      
      const requestedCount = 25;
      let selectedQuestions = [];
      
      if (neverSeenQuestions.length >= requestedCount) {
        selectedQuestions = neverSeenQuestions.slice(0, requestedCount);
        console.log(`✅ Seleccionaría ${selectedQuestions.length} nunca vistas`);
        
        // CRÍTICO: Verificar si alguna ya fue respondida
        const problemQuestions = selectedQuestions.filter(q => 
          answeredQuestionIds.has(q.id)
        );
        
        if (problemQuestions.length > 0) {
          console.log('🚨 BUG CONFIRMADO: Seleccionó preguntas ya respondidas');
          problemQuestions.slice(0, 3).forEach(pq => {
            console.log(`   ❌ ${pq.id} - marcada como nunca vista pero está en historial`);
          });
        } else {
          console.log('✅ Algoritmo funcionaría correctamente');
        }
      } else {
        const reviewCount = requestedCount - neverSeenQuestions.length;
        console.log(`⚠️ Distribución mixta: ${neverSeenQuestions.length} nunca vistas + ${reviewCount} repaso`);
      }
    }

    // 5. Comparar con el estado real reportado
    console.log('\n📊 STEP 5: Comparando con problema reportado...');
    console.log('El usuario reporta ver preguntas repetidas.');
    console.log('Análisis:');
    
    if (filteredHistory && filteredHistory.length > 0) {
      console.log(`✅ Usuario SÍ tiene historial: ${filteredHistory.length} respuestas`);
      
      const uniqueAnswered = new Set(filteredHistory.map(fh => fh.question_id));
      console.log(`📊 Preguntas únicas respondidas: ${uniqueAnswered.size}`);
      
      if (availableQuestions) {
        const shouldHaveNeverSeen = availableQuestions.length - uniqueAnswered.size;
        console.log(`📊 Nunca vistas que DEBERÍA tener: ${shouldHaveNeverSeen}`);
        
        if (shouldHaveNeverSeen > 0) {
          console.log('🎯 CONCLUSIÓN: Debería tener preguntas nunca vistas disponibles');
          console.log('🎯 Si ve repetidas, hay un bug en el algoritmo o en el filtrado');
        } else {
          console.log('🎯 CONCLUSIÓN: Ya respondió todas las preguntas disponibles');
          console.log('🎯 Ver repetidas sería comportamiento esperado');
        }
      }
    } else {
      console.log('⚠️ Usuario NO tiene historial filtrado válido');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugDeepInconsistency();