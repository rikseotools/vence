// scripts/test-cache-elimination.js
// Probar que el algoritmo funciona sin cache de sesión

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function testCacheElimination() {
  console.log('🚨 TESTANDO ELIMINACIÓN DE CACHE DE SESIÓN');
  console.log('='.repeat(60));

  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const temaNumber = 1;

  try {
    console.log(`\n📊 SIMULANDO ALGORITMO SIN CACHE DE SESIÓN:`);
    console.log(`Usuario: ${userId}`);
    console.log(`Tema: ${temaNumber}`);
    
    // 1️⃣ OBTENER HISTORIAL CORRECTO (filtrado por tema)
    console.log('\n1️⃣ HISTORIAL DEL USUARIO (filtrado por tema):');
    
    const { data: userHistory, error: historyError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('tema_number', temaNumber)  // ✅ FILTRO POR TEMA (nuestro fix)
      .eq('questions.is_active', true)
      .order('created_at', { ascending: false });

    if (historyError) {
      console.log('❌ Error obteniendo historial:', historyError.message);
      return;
    }

    const answeredIds = new Set(userHistory?.map(ua => ua.question_id) || []);
    console.log(`✅ Historial: ${userHistory?.length || 0} respuestas`);
    console.log(`✅ Preguntas únicas respondidas: ${answeredIds.size}`);

    // 2️⃣ OBTENER PREGUNTAS DISPONIBLES PARA TEMA 1
    console.log('\n2️⃣ PREGUNTAS DISPONIBLES PARA TEMA 1:');
    
    // Obtener mapeo del tema
    const { data: mappings, error: mappingError } = await supabase
      .from('topic_scope')
      .select(`
        article_numbers,
        laws!inner(short_name, id),
        topics!inner(topic_number, position_type)
      `)
      .eq('topics.topic_number', temaNumber)
      .eq('topics.position_type', 'auxiliar_administrativo');

    if (mappingError || !mappings?.length) {
      console.log('❌ Error obteniendo mapeo tema:', mappingError?.message);
      return;
    }

    // Obtener preguntas para cada ley del tema
    let allAvailableQuestions = [];
    for (const mapping of mappings) {
      if (!mapping.laws?.short_name) continue;

      const { data: questions } = await supabase
        .from('questions')
        .select(`
          id, question_text, difficulty, is_official_exam,
          articles!inner(laws!inner(short_name))
        `)
        .eq('is_active', true)
        .eq('articles.laws.short_name', mapping.laws.short_name)
        .in('articles.article_number', mapping.article_numbers)
        .order('created_at', { ascending: false });

      if (questions) {
        allAvailableQuestions = [...allAvailableQuestions, ...questions];
      }
    }

    console.log(`✅ Total preguntas disponibles: ${allAvailableQuestions.length}`);

    // 3️⃣ APLICAR ALGORITMO SIN CACHE
    console.log('\n3️⃣ ALGORITMO SIN CACHE DE SESIÓN:');

    // Clasificar preguntas por prioridad (igual que en el código real)
    const neverSeenQuestions = allAvailableQuestions.filter(q => !answeredIds.has(q.id));
    const answeredQuestions = allAvailableQuestions.filter(q => answeredIds.has(q.id));

    console.log(`📊 Clasificación correcta:`);
    console.log(`   👁️ Nunca vistas: ${neverSeenQuestions.length}`);
    console.log(`   ✅ Ya respondidas: ${answeredQuestions.length}`);

    // 4️⃣ SIMULAR DECISIÓN DEL ALGORITMO
    const numQuestions = 10;
    console.log(`\n4️⃣ DECISIÓN DEL ALGORITMO (${numQuestions} preguntas solicitadas):`);

    console.log(`   🔍 CONDICIÓN: ${neverSeenQuestions.length} >= ${numQuestions} = ${neverSeenQuestions.length >= numQuestions}`);

    let finalQuestions = [];
    if (neverSeenQuestions.length >= numQuestions) {
      console.log(`   🎯 CASO A: Solo preguntas nunca vistas`);
      console.log(`   📊 Distribución: ${numQuestions} nunca vistas + 0 repaso`);
      
      // Mezclar y seleccionar
      const shuffled = neverSeenQuestions.sort(() => Math.random() - 0.5);
      finalQuestions = shuffled.slice(0, numQuestions);
      
    } else {
      console.log(`   🎯 CASO B: Distribución mixta`);
      const reviewCount = numQuestions - neverSeenQuestions.length;
      console.log(`   📊 Distribución: ${neverSeenQuestions.length} nunca vistas + ${reviewCount} repaso`);
      
      // Todas las nunca vistas + las más antiguas para repaso
      const shuffledNeverSeen = neverSeenQuestions.sort(() => Math.random() - 0.5);
      const oldestForReview = answeredQuestions.slice(0, reviewCount);
      finalQuestions = [...shuffledNeverSeen, ...oldestForReview];
    }

    // 5️⃣ RESULTADO FINAL
    console.log(`\n5️⃣ RESULTADO FINAL:`);
    console.log(`✅ Preguntas seleccionadas: ${finalQuestions.length}`);
    console.log(`✅ IDs seleccionados: ${finalQuestions.map(q => q.id).slice(0, 5).join(', ')}${finalQuestions.length > 5 ? '...' : ''}`);

    // Verificar que no hay duplicados
    const questionIds = finalQuestions.map(q => q.id);
    const uniqueIds = new Set(questionIds);
    const hasDuplicates = uniqueIds.size !== questionIds.length;

    console.log(`🔍 Verificación de duplicados:`);
    console.log(`   Total IDs: ${questionIds.length}`);
    console.log(`   IDs únicos: ${uniqueIds.size}`);
    console.log(`   ¿Hay duplicados?: ${hasDuplicates ? '❌ SÍ' : '✅ NO'}`);

    // Verificar que todas son realmente nunca vistas (cuando aplique)
    if (neverSeenQuestions.length >= numQuestions) {
      const allAreNeverSeen = finalQuestions.every(q => !answeredIds.has(q.id));
      console.log(`   ¿Todas son nunca vistas?: ${allAreNeverSeen ? '✅ SÍ' : '❌ NO'}`);
      
      if (!allAreNeverSeen) {
        const alreadyAnswered = finalQuestions.filter(q => answeredIds.has(q.id));
        console.log(`   ❌ Preguntas ya respondidas incluidas: ${alreadyAnswered.map(q => q.id)}`);
      }
    }

    // 6️⃣ VEREDICTO FINAL
    console.log(`\n6️⃣ VEREDICTO:`);

    const isWorking = (
      !hasDuplicates &&
      finalQuestions.length === numQuestions &&
      (neverSeenQuestions.length < numQuestions || finalQuestions.every(q => !answeredIds.has(q.id)))
    );

    if (isWorking) {
      console.log('🎯 ✅ ALGORITMO SIN CACHE FUNCIONA PERFECTAMENTE');
      console.log('✅ No hay duplicados');
      console.log('✅ Cantidad correcta de preguntas');
      console.log('✅ Lógica de priorización correcta');
      console.log('✅ El usuario verá solo preguntas nunca vistas cuando hay suficientes');
      
    } else {
      console.log('🚨 ❌ TODAVÍA HAY PROBLEMAS');
      console.log(`❌ Duplicados: ${hasDuplicates}`);
      console.log(`❌ Cantidad incorrecta: ${finalQuestions.length !== numQuestions}`);
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

testCacheElimination();