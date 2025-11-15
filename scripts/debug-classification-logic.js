// scripts/debug-classification-logic.js
// Debuggear la lógica exacta de clasificación de la pregunta problemática

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function debugClassificationLogic() {
  console.log('🔍 DEBUG DE LÓGICA DE CLASIFICACIÓN');
  console.log('='.repeat(60));

  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const tema = 1;
  const targetQuestionId = '385ee94b-0d03-471e-baf3-8ee8dd18237b';

  try {
    // 1️⃣ REPLICAR EXACTLY LA QUERY DEL ALGORITMO
    console.log('\n1️⃣ REPLICANDO QUERY EXACTA DEL ALGORITMO:');
    
    const { data: userAnswers, error: answersError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('tema_number', tema) // 🚨 FIX: Solo historial del tema específico
      .eq('questions.is_active', true)
      .order('created_at', { ascending: false })
      .limit(2000);

    if (answersError) {
      console.log('❌ Error en query historial:', answersError.message);
      return;
    }

    console.log(`📊 Total respuestas usuario tema ${tema}: ${userAnswers?.length || 0}`);

    // 2️⃣ VERIFICAR SI LA PREGUNTA ESPECÍFICA ESTÁ EN EL HISTORIAL
    const targetInHistory = userAnswers?.find(answer => answer.question_id === targetQuestionId);
    console.log(`🎯 ¿Pregunta ${targetQuestionId} en historial?: ${targetInHistory ? 'SÍ ✅' : 'NO ❌'}`);
    
    if (targetInHistory) {
      console.log(`   📅 Fecha en historial: ${targetInHistory.created_at}`);
      console.log(`   ✅ is_active: ${targetInHistory.questions?.is_active}`);
    }

    // 3️⃣ REPLICAR EL PROCESO DE CONSTRUCCIÓN DE answeredQuestionIds
    console.log('\n2️⃣ CONSTRUCCIÓN DE ANSWERED QUESTION IDS:');
    
    const answeredQuestionIds = new Set();
    const questionLastAnswered = new Map();
    
    userAnswers?.forEach(answer => {
      answeredQuestionIds.add(answer.question_id);
      const answerDate = new Date(answer.created_at);
      
      // Guardar la fecha más reciente para cada pregunta
      if (!questionLastAnswered.has(answer.question_id) || 
          answerDate > questionLastAnswered.get(answer.question_id)) {
        questionLastAnswered.set(answer.question_id, answerDate);
      }
    });

    console.log(`📊 Total question IDs únicos: ${answeredQuestionIds.size}`);
    console.log(`🎯 ¿Target question en Set?: ${answeredQuestionIds.has(targetQuestionId) ? 'SÍ ✅' : 'NO ❌'}`);
    
    if (answeredQuestionIds.has(targetQuestionId)) {
      console.log(`   📅 Última respuesta: ${questionLastAnswered.get(targetQuestionId)}`);
    }

    // 4️⃣ OBTENER PREGUNTAS DISPONIBLES PARA EL TEMA
    console.log('\n3️⃣ OBTENIENDO PREGUNTAS DISPONIBLES:');
    
    // Obtener mapeo del tema desde topic_scope
    const { data: mappings, error: mappingError } = await supabase
      .from('topic_scope')
      .select(`
        article_numbers,
        laws!inner(short_name, id),
        topics!inner(topic_number, position_type)
      `)
      .eq('topics.topic_number', tema)
      .eq('topics.position_type', 'auxiliar_administrativo');

    if (mappingError || !mappings?.length) {
      console.log('❌ Error obteniendo mapeo tema:', mappingError?.message);
      return;
    }

    console.log(`📋 Mapeos encontrados: ${mappings.length}`);

    // Obtener preguntas para cada ley del tema
    let questionsToProcess = [];
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
        questionsToProcess = [...questionsToProcess, ...questions];
      }
    }

    console.log(`📊 Total preguntas disponibles: ${questionsToProcess.length}`);
    
    const targetInAvailable = questionsToProcess.find(q => q.id === targetQuestionId);
    console.log(`🎯 ¿Target question en disponibles?: ${targetInAvailable ? 'SÍ ✅' : 'NO ❌'}`);
    
    if (targetInAvailable) {
      console.log(`   📄 Texto: ${targetInAvailable.question_text.substring(0, 100)}...`);
      console.log(`   🏢 Ley: ${targetInAvailable.articles?.laws?.short_name}`);
    }

    // 5️⃣ REPLICAR EL PROCESO DE CLASIFICACIÓN
    console.log('\n4️⃣ PROCESO DE CLASIFICACIÓN:');
    
    const neverSeenQuestions = [];
    const answeredQuestions = [];
    
    questionsToProcess.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        // Pregunta ya respondida - agregar fecha para ordenamiento
        question._lastAnswered = questionLastAnswered.get(question.id);
        answeredQuestions.push(question);
      } else {
        // Pregunta nunca vista - máxima prioridad
        neverSeenQuestions.push(question);
      }
    });

    console.log(`📊 Nunca vistas: ${neverSeenQuestions.length}`);
    console.log(`📊 Ya respondidas: ${answeredQuestions.length}`);

    // Verificar clasificación de target question
    const targetInNeverSeen = neverSeenQuestions.find(q => q.id === targetQuestionId);
    const targetInAnswered = answeredQuestions.find(q => q.id === targetQuestionId);
    
    console.log(`🎯 Target question clasificada como:`);
    if (targetInNeverSeen) {
      console.log(`   👁️ NUNCA VISTA ✅`);
    } else if (targetInAnswered) {
      console.log(`   📚 YA RESPONDIDA ✅`);
      console.log(`   📅 Última respuesta: ${targetInAnswered._lastAnswered}`);
    } else {
      console.log(`   ❌ NO ENCONTRADA EN NINGUNA CATEGORÍA`);
    }

    // 6️⃣ SIMULAR LA DECISIÓN DEL ALGORITMO
    console.log('\n5️⃣ SIMULANDO DECISIÓN DEL ALGORITMO:');
    
    const numQuestions = 10;
    const uniqueNeverSeen = neverSeenQuestions.filter((question, index, arr) => 
      arr.findIndex(q => q.id === question.id) === index
    );
    
    const uniqueAnswered = answeredQuestions.filter((question, index, arr) => 
      arr.findIndex(q => q.id === question.id) === index
    );
    
    const neverSeenCount = uniqueNeverSeen.length;
    
    console.log(`📊 Nunca vistas únicas: ${neverSeenCount}`);
    console.log(`📊 Respondidas únicas: ${uniqueAnswered.length}`);
    console.log(`📊 Solicitadas: ${numQuestions}`);
    console.log(`🔍 CONDICIÓN: ${neverSeenCount} >= ${numQuestions} = ${neverSeenCount >= numQuestions}`);

    let finalQuestions = [];
    if (neverSeenCount >= numQuestions) {
      console.log('🎯 CASO A: Solo preguntas nunca vistas');
      console.log(`📊 Distribución: ${numQuestions} nunca vistas`);
      
      const shuffledNeverSeen = uniqueNeverSeen.sort(() => Math.random() - 0.5);
      finalQuestions = shuffledNeverSeen.slice(0, numQuestions);
      
    } else {
      console.log('🎯 CASO B: Distribución mixta');
      const reviewCount = numQuestions - neverSeenCount;
      console.log(`📊 Distribución: ${neverSeenCount} nunca vistas + ${reviewCount} repaso`);
      
      const shuffledNeverSeen = uniqueNeverSeen.sort(() => Math.random() - 0.5);
      const oldestForReview = uniqueAnswered.slice(0, reviewCount);
      finalQuestions = [...shuffledNeverSeen, ...oldestForReview];
    }

    // Verificar si target question está en resultado final
    const targetInFinal = finalQuestions.find(q => q.id === targetQuestionId);
    console.log(`🎯 ¿Target question en resultado final?: ${targetInFinal ? 'SÍ ✅' : 'NO ❌'}`);

    // 7️⃣ DIAGNÓSTICO FINAL
    console.log('\n6️⃣ DIAGNÓSTICO FINAL:');
    
    if (targetInHistory && !answeredQuestionIds.has(targetQuestionId)) {
      console.log('🚨 INCONSISTENCIA: Pregunta en historial pero NO en answeredQuestionIds');
    } else if (!targetInHistory && answeredQuestionIds.has(targetQuestionId)) {
      console.log('🚨 INCONSISTENCIA: Pregunta en answeredQuestionIds pero NO en historial');
    } else if (targetInHistory && answeredQuestionIds.has(targetQuestionId)) {
      console.log('✅ CONSISTENCIA: Pregunta en historial Y en answeredQuestionIds');
      if (targetInNeverSeen) {
        console.log('🚨 ERROR LÓGICO: Debería clasificarse como respondida, no como nunca vista');
      } else {
        console.log('✅ CLASIFICACIÓN CORRECTA: Como ya respondida');
      }
    } else {
      console.log('✅ CONSISTENCIA: Pregunta no en historial ni en answeredQuestionIds');
      if (targetInAnswered) {
        console.log('🚨 ERROR LÓGICO: Debería clasificarse como nunca vista, no como respondida');
      } else {
        console.log('✅ CLASIFICACIÓN CORRECTA: Como nunca vista');
      }
    }

    // Mostrar algunas preguntas del historial para debug
    console.log('\n📋 MUESTRA DEL HISTORIAL:');
    const sample = userAnswers?.slice(0, 5) || [];
    sample.forEach((answer, idx) => {
      console.log(`   ${idx + 1}. ${answer.question_id} - ${answer.created_at}`);
    });

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

debugClassificationLogic();