// scripts/debug-case-selection.js
// Debuggear por qué elige CASO B en lugar de CASO A

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function debugCaseSelection() {
  console.log('🔍 DEBUG: ¿Por qué elige CASO B en lugar de CASO A?');
  console.log('='.repeat(60));

  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const numQuestions = 10; // Como en los logs

  try {
    console.log('\n📊 PASO 1: Replicando la query exacta del código...');

    // Esta es la query exacta de fetchQuestionsByTopicScope
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d, 
        correct_option, explanation, difficulty, is_official_exam, created_at,
        articles!inner(
          id, article_number, title,
          laws!inner(id, short_name, name)
        )
      `)
      .eq('is_active', true)
      .eq('articles.laws.short_name', 'CE')
      .order('created_at', { ascending: false });

    if (questionsError) {
      console.error('❌ Error:', questionsError.message);
      return;
    }

    console.log(`✅ Preguntas CE encontradas: ${questions?.length || 0}`);

    // Query de historial exacta
    console.log('\n📊 PASO 2: Obteniendo historial...');

    const { data: userAnswers, error: historyError } = await supabase
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
      .eq('questions.articles.laws.short_name', 'CE')
      .order('created_at', { ascending: false });

    if (historyError) {
      console.error('❌ Error historial:', historyError.message);
      return;
    }

    console.log(`✅ Historial CE encontrado: ${userAnswers?.length || 0} respuestas`);

    // Replicar EXACTAMENTE la lógica del código
    console.log('\n📊 PASO 3: Aplicando lógica EXACTA del algoritmo...');

    const answeredQuestionIds = new Set();
    const questionLastAnswered = new Map();

    if (userAnswers && userAnswers.length > 0) {
      userAnswers.forEach(answer => {
        answeredQuestionIds.add(answer.question_id);
        const answerDate = new Date(answer.created_at);
        
        if (!questionLastAnswered.has(answer.question_id) || 
            answerDate > questionLastAnswered.get(answer.question_id)) {
          questionLastAnswered.set(answer.question_id, answerDate);
        }
      });
    }

    console.log(`📊 Set de respondidas: ${answeredQuestionIds.size} IDs únicos`);

    // Clasificación EXACTA
    const neverSeenQuestions = questions?.filter(q => !answeredQuestionIds.has(q.id)) || [];
    const answeredQuestions = questions?.filter(q => answeredQuestionIds.has(q.id)) || [];

    console.log(`📊 Clasificación inicial:`);
    console.log(`   📗 Nunca vistas originales: ${neverSeenQuestions.length}`);
    console.log(`   📚 Ya respondidas originales: ${answeredQuestions.length}`);

    // Aplicar deduplicación EXACTA como en el código
    const uniqueNeverSeen = neverSeenQuestions.filter((question, index, arr) => 
      arr.findIndex(q => q.id === question.id) === index
    );
    
    const uniqueAnswered = answeredQuestions.filter((question, index, arr) => 
      arr.findIndex(q => q.id === question.id) === index
    );

    const neverSeenCount = uniqueNeverSeen.length;

    console.log(`📊 DESPUÉS DE DEDUPLICACIÓN:`);
    console.log(`   📗 Nunca vistas únicas: ${uniqueNeverSeen.length}`);
    console.log(`   📚 Ya respondidas únicas: ${uniqueAnswered.length}`);

    // AQUÍ ESTÁ EL MOMENTO CRÍTICO
    console.log(`\n🎯 MOMENTO DE DECISIÓN:`);
    console.log(`   numQuestions solicitadas: ${numQuestions}`);
    console.log(`   neverSeenCount disponibles: ${neverSeenCount}`);
    console.log(`   Condición: neverSeenCount (${neverSeenCount}) >= numQuestions (${numQuestions})`);
    console.log(`   Resultado: ${neverSeenCount >= numQuestions}`);

    if (neverSeenCount >= numQuestions) {
      console.log(`\n✅ DEBERÍA ELEGIR CASO A: Solo nunca vistas`);
      console.log(`📊 Distribución correcta: ${numQuestions} nunca vistas + 0 repaso`);
    } else {
      console.log(`\n❌ VA A ELEGIR CASO B: Distribución mixta`);
      const reviewCount = numQuestions - neverSeenCount;
      console.log(`📊 Distribución mixta: ${neverSeenCount} nunca vistas + ${reviewCount} repaso`);
    }

    // Verificar si hay algo raro en los datos
    console.log(`\n🔍 ANÁLISIS ADICIONAL:`);
    
    // ¿Hay duplicados en neverSeenQuestions?
    const duplicatesInNeverSeen = neverSeenQuestions.length - uniqueNeverSeen.length;
    console.log(`   Duplicados en nunca vistas: ${duplicatesInNeverSeen}`);
    
    if (duplicatesInNeverSeen > 0) {
      console.log(`   🚨 HAY ${duplicatesInNeverSeen} DUPLICADOS EN NUNCA VISTAS!`);
      
      // Encontrar los duplicados
      const seenIds = new Set();
      const duplicateIds = new Set();
      
      neverSeenQuestions.forEach(q => {
        if (seenIds.has(q.id)) {
          duplicateIds.add(q.id);
        } else {
          seenIds.add(q.id);
        }
      });
      
      console.log(`   🔍 IDs duplicados: [${Array.from(duplicateIds).slice(0, 5).join(', ')}...]`);
    }

    // Verificar si alguna "nunca vista" está realmente en el historial
    console.log(`\n🔍 VERIFICACIÓN CRUZADA:`);
    let misclassified = 0;
    
    uniqueNeverSeen.slice(0, 10).forEach((q, i) => {
      const inHistory = answeredQuestionIds.has(q.id);
      if (inHistory) {
        console.log(`   ❌ PREGUNTA MAL CLASIFICADA: ${q.id} está marcada como "nunca vista" pero SÍ está en historial`);
        misclassified++;
      } else if (i < 3) {
        console.log(`   ✅ Pregunta ${i+1}: ${q.id} correctamente como "nunca vista"`);
      }
    });

    if (misclassified > 0) {
      console.log(`\n🚨 PROBLEMA ENCONTRADO: ${misclassified} preguntas mal clasificadas!`);
    } else {
      console.log(`\n✅ Clasificación parece correcta`);
    }

    // El problema puede estar en la segunda condición dentro del CASO B
    console.log(`\n🤔 TEORÍA: ¿Hay una segunda verificación dentro del algoritmo?`);
    console.log(`Verificar si hay código adicional que sobrescribe la decisión...`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugCaseSelection();