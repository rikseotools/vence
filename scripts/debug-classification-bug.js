// scripts/debug-classification-bug.js
// Debuggear el problema de clasificación incorrecta

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function debugClassificationBug() {
  console.log('🐛 DEBUGGING PROBLEMA DE CLASIFICACIÓN');
  console.log('='.repeat(50));

  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const problematicQuestionId = '1f2b0d59-5ee0-4256-a19d-e0de0eb72328';

  try {
    // 1. Verificar esta pregunta específica en el historial
    console.log('\n📊 PASO 1: Verificando pregunta problemática en historial...');
    
    const { data: historialCompleto } = await supabase
      .from('test_questions')
      .select('question_id, created_at, tests!inner(user_id)')
      .eq('tests.user_id', userId)
      .eq('question_id', problematicQuestionId)
      .order('created_at', { ascending: false });

    console.log(`📊 Esta pregunta en historial: ${historialCompleto?.length || 0} veces`);
    if (historialCompleto && historialCompleto.length > 0) {
      historialCompleto.forEach((h, i) => {
        console.log(`   ${i + 1}. ${new Date(h.created_at).toLocaleString()}`);
      });
    }

    // 2. Obtener historial completo del usuario
    console.log('\n📊 PASO 2: Obteniendo historial completo...');
    
    const { data: userAnswers } = await supabase
      .from('test_questions')
      .select('question_id, created_at, tests!inner(user_id)')
      .eq('tests.user_id', userId)
      .order('created_at', { ascending: false });

    const answeredIds = new Set(userAnswers?.map(ua => ua.question_id) || []);
    console.log(`📊 Total respuestas únicas: ${answeredIds.size}`);
    console.log(`📊 Esta pregunta está en historial: ${answeredIds.has(problematicQuestionId)}`);

    // 3. Obtener preguntas disponibles de CE (que es lo que está consultando)
    console.log('\n📊 PASO 3: Obteniendo preguntas disponibles de CE...');
    
    const { data: availableQuestions } = await supabase
      .from('questions')
      .select(`
        id, question_text,
        articles!inner(
          laws!inner(short_name)
        )
      `)
      .eq('is_active', true)
      .eq('articles.laws.short_name', 'CE')
      .order('created_at', { ascending: false });

    const availableIds = new Set(availableQuestions?.map(q => q.id) || []);
    console.log(`📊 Preguntas disponibles CE: ${availableQuestions?.length || 0}`);
    console.log(`📊 Esta pregunta está disponible: ${availableIds.has(problematicQuestionId)}`);

    // 4. Aplicar el algoritmo REAL como lo hace fetchQuestionsByTopicScope
    console.log('\n📊 PASO 4: Aplicando algoritmo de clasificación...');
    
    if (availableQuestions && userAnswers) {
      const neverSeenQuestions = availableQuestions.filter(q => !answeredIds.has(q.id));
      const answeredQuestions = availableQuestions.filter(q => answeredIds.has(q.id));
      
      console.log(`📊 Clasificación:`);
      console.log(`   - Total disponibles: ${availableQuestions.length}`);
      console.log(`   - Nunca vistas: ${neverSeenQuestions.length}`);
      console.log(`   - Ya respondidas: ${answeredQuestions.length}`);
      
      const isInNeverSeen = neverSeenQuestions.some(q => q.id === problematicQuestionId);
      const isInAnswered = answeredQuestions.some(q => q.id === problematicQuestionId);
      
      console.log(`\n🎯 PREGUNTA PROBLEMÁTICA (${problematicQuestionId}):`);
      console.log(`   - En "nunca vistas": ${isInNeverSeen ? '✅ SÍ' : '❌ NO'}`);
      console.log(`   - En "ya respondidas": ${isInAnswered ? '✅ SÍ' : '❌ NO'}`);
      console.log(`   - En historial usuario: ${answeredIds.has(problematicQuestionId) ? '✅ SÍ' : '❌ NO'}`);
      console.log(`   - En disponibles: ${availableIds.has(problematicQuestionId) ? '✅ SÍ' : '❌ NO'}`);
      
      if (isInNeverSeen && answeredIds.has(problematicQuestionId)) {
        console.log('\n🚨 BUG CONFIRMADO: Pregunta clasificada como nunca vista cuando SÍ está en historial!');
        console.log('🔍 Investigando la causa...');
        
        // Verificar si hay problema de tipos de datos
        const userAnswerIds = userAnswers.map(ua => ua.question_id);
        const availableQuestionIds = availableQuestions.map(q => q.id);
        
        console.log('\n📊 ANÁLISIS DE IDs:');
        console.log(`   Tipo ID en historial: ${typeof userAnswerIds[0]}`);
        console.log(`   Tipo ID en disponibles: ${typeof availableQuestionIds[0]}`);
        console.log(`   Ejemplo ID historial: "${userAnswerIds[0]}"`);
        console.log(`   Ejemplo ID disponible: "${availableQuestionIds[0]}"`);
        
        // Buscar el ID específico en ambos arrays
        const foundInHistory = userAnswerIds.includes(problematicQuestionId);
        const foundInAvailable = availableQuestionIds.includes(problematicQuestionId);
        
        console.log(`\n🔍 ID específico "${problematicQuestionId}":`);
        console.log(`   En array historial: ${foundInHistory}`);
        console.log(`   En array disponibles: ${foundInAvailable}`);
        
        if (foundInHistory && foundInAvailable) {
          console.log('🚨 AMBOS ARRAYS TIENEN EL ID - EL FILTRO ESTÁ FALLANDO');
          
          // Test del filtro manualmente
          const manualFilter = availableQuestions.filter(q => {
            const hasId = answeredIds.has(q.id);
            if (q.id === problematicQuestionId) {
              console.log(`   🔍 Manual filter para ${q.id}: answeredIds.has() = ${hasId}`);
            }
            return !hasId;
          });
          
          const stillInNeverSeen = manualFilter.some(q => q.id === problematicQuestionId);
          console.log(`   Manual filter result: ${stillInNeverSeen ? 'STILL IN NEVER SEEN' : 'CORRECTLY FILTERED OUT'}`);
        }
      }
    }

    // 5. Simular exactamente lo que hace fetchQuestionsByTopicScope
    console.log('\n📊 PASO 5: Simulando fetchQuestionsByTopicScope...');
    
    if (availableQuestions && userAnswers) {
      // Esto es EXACTAMENTE el código de fetchQuestionsByTopicScope
      const answeredQuestionIds = new Set()
      const questionLastAnswered = new Map()

      if (userAnswers && userAnswers.length > 0) {
        userAnswers.forEach(answer => {
          answeredQuestionIds.add(answer.question_id)
          const answerDate = new Date(answer.created_at)
          
          if (!questionLastAnswered.has(answer.question_id) || 
              answerDate > questionLastAnswered.get(answer.question_id)) {
            questionLastAnswered.set(answer.question_id, answerDate)
          }
        })
      }

      const neverSeenQuestions = availableQuestions.filter(q => !answeredQuestionIds.has(q.id))
      const answeredQuestions = availableQuestions.filter(q => answeredQuestionIds.has(q.id))
      
      console.log(`📊 Resultado simulación exacta:`);
      console.log(`   - Set size: ${answeredQuestionIds.size}`);
      console.log(`   - Nunca vistas: ${neverSeenQuestions.length}`);
      console.log(`   - Ya respondidas: ${answeredQuestions.length}`);
      
      const inNeverSeenSimulation = neverSeenQuestions.some(q => q.id === problematicQuestionId);
      console.log(`   - Pregunta problemática en nunca vistas: ${inNeverSeenSimulation}`);
      
      if (inNeverSeenSimulation) {
        console.log('\n🚨 SIMULACIÓN CONFIRMA EL BUG');
        console.log(`   Set contiene ID: ${answeredQuestionIds.has(problematicQuestionId)}`);
        console.log(`   Filtro debería excluirla: ${!answeredQuestionIds.has(problematicQuestionId)}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugClassificationBug();