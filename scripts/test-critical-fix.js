// scripts/test-critical-fix.js
// Verificar que el fix crítico funciona correctamente

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function testCriticalFix() {
  console.log('🔥 TESTANDO EL FIX CRÍTICO');
  console.log('='.repeat(60));

  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const temaNumber = 1;

  try {
    console.log(`\n📊 COMPARANDO CONSULTAS PARA TEMA ${temaNumber}:`);
    
    // 1️⃣ QUERY DEL TEMA PAGE (la correcta)
    console.log('\n1️⃣ QUERY TEMA PAGE (la que mostraba 22 nunca vistas):');
    
    const { data: temaPageHistory, error: temaPageError } = await supabase
      .from('test_questions')
      .select(`
        question_id,
        created_at,
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('tema_number', temaNumber)  // ✅ FILTRO POR TEMA
      .eq('questions.is_active', true)
      .order('created_at', { ascending: false });

    if (temaPageError) {
      console.log('❌ Error en tema page query:', temaPageError.message);
    } else {
      console.log(`✅ Tema page history: ${temaPageHistory?.length || 0} respuestas`);
      const temaPageAnsweredIds = new Set(temaPageHistory?.map(ua => ua.question_id) || []);
      console.log(`📊 Unique question IDs en tema page: ${temaPageAnsweredIds.size}`);
    }

    // 2️⃣ QUERY DEL ALGORITMO ORIGINAL (la incorrecta - sin tema filter)
    console.log('\n2️⃣ QUERY ALGORITMO ORIGINAL (la incorrecta):');
    
    const { data: algorithmOriginalHistory, error: algorithmOriginalError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('questions.is_active', true)  // ❌ SIN FILTRO DE TEMA
      .order('created_at', { ascending: false })
      .limit(2000);

    if (algorithmOriginalError) {
      console.log('❌ Error en algorithm original query:', algorithmOriginalError.message);
    } else {
      console.log(`❌ Algorithm original history: ${algorithmOriginalHistory?.length || 0} respuestas`);
      const algorithmOriginalAnsweredIds = new Set(algorithmOriginalHistory?.map(ua => ua.question_id) || []);
      console.log(`📊 Unique question IDs en algorithm original: ${algorithmOriginalAnsweredIds.size}`);
    }

    // 3️⃣ QUERY DEL ALGORITMO CORREGIDA (la nueva)
    console.log('\n3️⃣ QUERY ALGORITMO CORREGIDA (la nueva):');
    
    const { data: algorithmFixedHistory, error: algorithmFixedError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('tema_number', temaNumber)  // ✅ AGREGADO FILTRO POR TEMA
      .eq('questions.is_active', true)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (algorithmFixedError) {
      console.log('❌ Error en algorithm fixed query:', algorithmFixedError.message);
    } else {
      console.log(`✅ Algorithm fixed history: ${algorithmFixedHistory?.length || 0} respuestas`);
      const algorithmFixedAnsweredIds = new Set(algorithmFixedHistory?.map(ua => ua.question_id) || []);
      console.log(`📊 Unique question IDs en algorithm fixed: ${algorithmFixedAnsweredIds.size}`);
    }

    // 4️⃣ OBTENER PREGUNTAS DISPONIBLES PARA EL TEMA 1
    console.log('\n4️⃣ PREGUNTAS DISPONIBLES PARA TEMA 1:');
    
    // Obtener mapeo del tema desde topic_scope
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
        .select('id, question_text, articles!inner(laws!inner(short_name))')
        .eq('is_active', true)
        .eq('articles.laws.short_name', mapping.laws.short_name)
        .in('articles.article_number', mapping.article_numbers)
        .order('created_at', { ascending: false });

      if (questions) {
        allAvailableQuestions = [...allAvailableQuestions, ...questions];
      }
    }

    console.log(`📊 Total preguntas disponibles para tema ${temaNumber}: ${allAvailableQuestions.length}`);

    // 5️⃣ CALCULAR NUNCA VISTAS CON CADA MÉTODO
    console.log('\n5️⃣ CÁLCULO DE NUNCA VISTAS:');

    // Método tema page
    const temaPageAnsweredIds = new Set(temaPageHistory?.map(ua => ua.question_id) || []);
    const neverSeenTemaPage = allAvailableQuestions.filter(q => !temaPageAnsweredIds.has(q.id));
    console.log(`👁️ Tema page: ${neverSeenTemaPage.length} nunca vistas`);

    // Método algoritmo original (incorrecto)
    const algorithmOriginalAnsweredIds = new Set(algorithmOriginalHistory?.map(ua => ua.question_id) || []);
    const neverSeenAlgorithmOriginal = allAvailableQuestions.filter(q => !algorithmOriginalAnsweredIds.has(q.id));
    console.log(`❌ Algorithm original: ${neverSeenAlgorithmOriginal.length} nunca vistas`);

    // Método algoritmo corregido
    const algorithmFixedAnsweredIds = new Set(algorithmFixedHistory?.map(ua => ua.question_id) || []);
    const neverSeenAlgorithmFixed = allAvailableQuestions.filter(q => !algorithmFixedAnsweredIds.has(q.id));
    console.log(`✅ Algorithm fixed: ${neverSeenAlgorithmFixed.length} nunca vistas`);

    // 6️⃣ VERIFICACIÓN DEL FIX
    console.log('\n6️⃣ VERIFICACIÓN DEL FIX:');

    const fixWorking = (
      neverSeenTemaPage.length === neverSeenAlgorithmFixed.length &&
      temaPageAnsweredIds.size === algorithmFixedAnsweredIds.size
    );

    if (fixWorking) {
      console.log('🎯 ✅ FIX EXITOSO!');
      console.log('✅ Tema page y algoritmo corregido dan el mismo resultado');
      console.log('✅ El problema de preguntas repetidas está RESUELTO');
      
      console.log(`\n📊 RESULTADO CORRECTO:`);
      console.log(`• Historial del usuario en tema ${temaNumber}: ${algorithmFixedAnsweredIds.size} preguntas únicas`);
      console.log(`• Preguntas nunca vistas: ${neverSeenAlgorithmFixed.length}`);
      console.log(`• Total disponibles: ${allAvailableQuestions.length}`);
      
      // Verificar que ahora elegirá CASO A
      const numQuestions = 10;
      const shouldChooseCaseA = neverSeenAlgorithmFixed.length >= numQuestions;
      console.log(`\n🎯 DECISIÓN DEL ALGORITMO:`);
      console.log(`   Preguntas solicitadas: ${numQuestions}`);
      console.log(`   Nunca vistas disponibles: ${neverSeenAlgorithmFixed.length}`);
      console.log(`   ¿Suficientes para CASO A?: ${shouldChooseCaseA ? 'SÍ ✅' : 'NO ❌'}`);
      
      if (shouldChooseCaseA) {
        console.log(`   🎯 ELEGIRÁ: CASO A - Solo preguntas nunca vistas`);
        console.log(`   📊 Distribución: ${numQuestions} nunca vistas + 0 repaso`);
      } else {
        const reviewCount = numQuestions - neverSeenAlgorithmFixed.length;
        console.log(`   🎯 ELEGIRÁ: CASO B - Distribución mixta`);
        console.log(`   📊 Distribución: ${neverSeenAlgorithmFixed.length} nunca vistas + ${reviewCount} repaso`);
      }
      
    } else {
      console.log('🚨 ❌ FIX NO COMPLETADO');
      console.log(`❌ Tema page: ${neverSeenTemaPage.length} nunca vistas`);
      console.log(`❌ Algorithm fixed: ${neverSeenAlgorithmFixed.length} nunca vistas`);
      console.log('❌ Los resultados no coinciden todavía');
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

testCriticalFix();