// scripts/debug-current-repeated-question.js
// Debuggear la pregunta específica que acaba de aparecer repetida

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function debugCurrentRepeatedQuestion() {
  console.log('🔍 DEBUG: PREGUNTA REPETIDA ACTUAL');
  console.log('='.repeat(60));

  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const targetQuestionId = 'b554d66f-8b94-4a5c-a72a-7c2f25cad5e8'; // La que acaba de aparecer
  const tema = 1;

  try {
    // 1️⃣ VERIFICAR HISTORIAL EN test_questions PARA TEMA 1
    console.log('\n1️⃣ HISTORIAL EN test_questions PARA TEMA 1:');
    
    const { data: tema1History, error: t1Error } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tema_number,
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('tema_number', tema)
      .eq('questions.is_active', true)
      .eq('question_id', targetQuestionId)
      .order('created_at', { ascending: false });

    if (t1Error) {
      console.log('❌ Error tema 1:', t1Error.message);
    } else {
      console.log(`📊 Registros algoritmo tema 1: ${tema1History?.length || 0}`);
      tema1History?.forEach((record, idx) => {
        console.log(`   ${idx + 1}. ${record.created_at} - Tema: ${record.tema_number}`);
      });
    }

    // 2️⃣ VERIFICAR HISTORIAL EN test_questions SIN FILTRO DE TEMA
    console.log('\n2️⃣ HISTORIAL EN test_questions SIN FILTRO TEMA:');
    
    const { data: allHistory, error: allError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tema_number,
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('questions.is_active', true)
      .eq('question_id', targetQuestionId)
      .order('created_at', { ascending: false });

    if (allError) {
      console.log('❌ Error historial general:', allError.message);
    } else {
      console.log(`📊 Total registros (todos los temas): ${allHistory?.length || 0}`);
      allHistory?.forEach((record, idx) => {
        console.log(`   ${idx + 1}. ${record.created_at} - Tema: ${record.tema_number}`);
      });
    }

    // 3️⃣ VERIFICAR EN QUE TEMA ESTÁN LOS 4 REGISTROS DE QUESTIONEVOLUTION
    console.log('\n3️⃣ DISTRIBUCIÓN POR TEMA DE LOS 4 REGISTROS:');
    
    if (allHistory && allHistory.length > 0) {
      const byTema = allHistory.reduce((acc, record) => {
        const tema = record.tema_number || 'null';
        if (!acc[tema]) acc[tema] = 0;
        acc[tema]++;
        return acc;
      }, {});
      
      console.log('📊 Distribución por tema:', byTema);
      
      // Verificar si TODOS los registros son de tema 0 o null
      const tema1Count = allHistory.filter(r => r.tema_number === 1).length;
      const otherTemasCount = allHistory.length - tema1Count;
      
      console.log(`📊 Resumen:`);
      console.log(`   • Tema 1: ${tema1Count} registros`);
      console.log(`   • Otros temas: ${otherTemasCount} registros`);
      
      if (tema1Count === 0 && otherTemasCount > 0) {
        console.log('\n🎯 EXPLICACIÓN DEL PROBLEMA:');
        console.log('   ✅ La pregunta SÍ tiene historial (4 intentos)');
        console.log('   ❌ Pero NINGÚN intento fue en tema 1');
        console.log('   ❌ Por eso el algoritmo la clasifica como "nunca vista" para tema 1');
        console.log('   ❌ Pero QuestionEvolution la muestra como "repetida" (global)');
        console.log('\n💡 ESTO SIGNIFICA:');
        console.log('   • El algoritmo está técnicamente correcto');
        console.log('   • Pero la pregunta NO debería estar disponible para tema 1');
        console.log('   • Hay un problema en el mapeo pregunta → tema');
      }
    }

    // 4️⃣ VERIFICAR SI LA PREGUNTA DEBERÍA ESTAR EN TEMA 1
    console.log('\n4️⃣ VERIFICAR MAPEO PREGUNTA → TEMA:');
    
    const { data: questionInfo, error: qiError } = await supabase
      .from('questions')
      .select(`
        id, question_text, 
        articles!inner(
          article_number,
          laws!inner(short_name)
        )
      `)
      .eq('id', targetQuestionId)
      .single();

    if (qiError || !questionInfo) {
      console.log('❌ Error info pregunta:', qiError?.message);
    } else {
      console.log(`📄 Pregunta: ${questionInfo.question_text.substring(0, 80)}...`);
      console.log(`📚 Ley: ${questionInfo.articles?.laws?.short_name}`);
      console.log(`📄 Artículo: ${questionInfo.articles?.article_number}`);
      
      // Verificar si esta ley/artículo está en el mapeo del tema 1
      const { data: tema1Mapping } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name),
          topics!inner(topic_number)
        `)
        .eq('topics.topic_number', tema)
        .eq('laws.short_name', questionInfo.articles?.laws?.short_name);

      if (tema1Mapping && tema1Mapping.length > 0) {
        const mapping = tema1Mapping[0];
        const isArticleInTema = mapping.article_numbers.includes(questionInfo.articles?.article_number);
        
        console.log(`📋 Mapeo tema 1 para ley ${questionInfo.articles?.laws?.short_name}:`);
        console.log(`   📄 Artículos incluidos: ${mapping.article_numbers.join(', ')}`);
        console.log(`   🎯 ¿Artículo ${questionInfo.articles?.article_number} incluido?: ${isArticleInTema ? 'SÍ ✅' : 'NO ❌'}`);
        
        if (isArticleInTema) {
          console.log('\n🚨 PROBLEMA CONFIRMADO:');
          console.log('   • La pregunta SÍ debería estar en tema 1');
          console.log('   • Tiene historial pero NO para tema 1');
          console.log('   • El algoritmo la incluye porque no tiene historial tema 1');
          console.log('   • Pero ya fue respondida en otros contextos (tema 0, etc.)');
        } else {
          console.log('\n✅ NO ES UN PROBLEMA:');
          console.log('   • La pregunta NO debería estar en tema 1');
          console.log('   • Hay un error en el mapeo o en la disponibilidad');
        }
      } else {
        console.log('❌ No se encontró mapeo para esta ley en tema 1');
      }
    }

    // 5️⃣ DIAGNÓSTICO FINAL
    console.log('\n5️⃣ DIAGNÓSTICO FINAL:');
    console.log(`📊 RESUMEN:`);
    console.log(`   • Historial tema 1: ${tema1History?.length || 0} registros`);
    console.log(`   • Historial total: ${allHistory?.length || 0} registros`);
    console.log(`   • Pregunta disponible tema 1: Verificado arriba`);
    
    if ((tema1History?.length || 0) === 0 && (allHistory?.length || 0) > 0) {
      console.log('\n🎯 CONCLUSIÓN:');
      console.log('   Esta pregunta fue respondida en otros contextos (tema 0, tests generales, etc.)');
      console.log('   Pero nunca específicamente en tema 1');
      console.log('   Por eso aparece en el test tema 1 como "nunca vista"');
      console.log('   Pero QuestionEvolution la muestra como "repetida"');
      console.log('\n💡 POSIBLES SOLUCIONES:');
      console.log('   A) El algoritmo debería considerar historial global, no solo por tema');
      console.log('   B) O el mapeo de preguntas a temas tiene problemas');
      console.log('   C) O hay inconsistencias en cómo se asignan los tema_number');
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

debugCurrentRepeatedQuestion();