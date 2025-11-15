// scripts/test-intelligent-adaptive-system.js
// Probar el nuevo sistema adaptativo inteligente

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function testIntelligentAdaptiveSystem() {
  console.log('🧠 PROBANDO SISTEMA ADAPTATIVO INTELIGENTE');
  console.log('='.repeat(60));

  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';
  const tema = 1;

  try {
    console.log('\n1️⃣ SIMULANDO LLAMADA CON adaptive=true:');
    
    // Simular parámetros URL con adaptive=true
    const searchParams = new URLSearchParams({
      n: '10',
      adaptive: 'true',
      exclude_recent: 'false',
      recent_days: '7',
      difficulty_mode: 'random'
    });

    console.log('📋 Parámetros simulados:', Object.fromEntries(searchParams));

    // 🧠 REPLICAR LA LÓGICA DEL FETCHQUESTIONSBYTOPICSCOPE MODIFICADO
    console.log('\n2️⃣ OBTENIENDO MAPEO DEL TEMA:');
    
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

    console.log(`✅ Mapeos encontrados: ${mappings.length}`);

    // 🧠 OBTENER PREGUNTAS DISPONIBLES
    console.log('\n3️⃣ OBTENIENDO TODAS LAS PREGUNTAS DISPONIBLES:');
    
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
        .in('articles.article_number', mapping.article_numbers);

      if (questions) {
        questionsToProcess = [...questionsToProcess, ...questions];
      }
    }

    console.log(`📊 Total preguntas disponibles: ${questionsToProcess.length}`);

    // 🧠 OBTENER HISTORIAL DEL USUARIO
    console.log('\n4️⃣ OBTENIENDO HISTORIAL DEL USUARIO:');
    
    const { data: userAnswers, error: answersError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id),
        questions!inner(is_active)
      `)
      .eq('tests.user_id', userId)
      .eq('tema_number', tema)
      .eq('questions.is_active', true)
      .order('created_at', { ascending: false });

    if (answersError) {
      console.log('❌ Error obteniendo historial:', answersError.message);
      return;
    }

    console.log(`📊 Historial del usuario: ${userAnswers?.length || 0} respuestas`);

    // 🧠 GENERAR CATÁLOGO CLASIFICADO
    console.log('\n5️⃣ GENERANDO CATÁLOGO CLASIFICADO:');
    
    const answeredQuestionIds = new Set();
    if (userAnswers && userAnswers.length > 0) {
      userAnswers.forEach(answer => {
        answeredQuestionIds.add(answer.question_id);
      });
    }

    // Separar nunca vistas vs ya respondidas
    const neverSeenQuestions = [];
    const answeredQuestions = [];

    questionsToProcess.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        answeredQuestions.push(question);
      } else {
        neverSeenQuestions.push(question);
      }
    });

    // Clasificar por dificultad
    const catalogByDifficulty = {
      neverSeen: {
        easy: neverSeenQuestions.filter(q => q.difficulty === 'easy'),
        medium: neverSeenQuestions.filter(q => q.difficulty === 'medium'),
        hard: neverSeenQuestions.filter(q => q.difficulty === 'hard')
      },
      answered: {
        easy: answeredQuestions.filter(q => q.difficulty === 'easy'),
        medium: answeredQuestions.filter(q => q.difficulty === 'medium'),
        hard: answeredQuestions.filter(q => q.difficulty === 'hard')
      }
    };

    console.log('🧠 CATÁLOGO GENERADO:');
    console.log(`   👁️ Nunca vistas: easy=${catalogByDifficulty.neverSeen.easy.length}, medium=${catalogByDifficulty.neverSeen.medium.length}, hard=${catalogByDifficulty.neverSeen.hard.length}`);
    console.log(`   📚 Ya respondidas: easy=${catalogByDifficulty.answered.easy.length}, medium=${catalogByDifficulty.answered.medium.length}, hard=${catalogByDifficulty.answered.hard.length}`);

    // 🧠 SIMULAR DECISIONES ADAPTATIVAS
    console.log('\n6️⃣ SIMULANDO DECISIONES ADAPTATIVAS:');
    
    const numQuestions = 10;
    console.log(`📊 Se necesitan ${numQuestions} preguntas`);

    // Simular adaptación a "fácil" 
    console.log('\n🧠 CASO: Usuario necesita preguntas FÁCILES');
    const neverSeenEasy = catalogByDifficulty.neverSeen.easy;
    const neverSeenMedium = catalogByDifficulty.neverSeen.medium;
    const answeredEasy = catalogByDifficulty.answered.easy;

    console.log(`   📊 Nunca vistas fáciles: ${neverSeenEasy.length}`);
    console.log(`   📊 Nunca vistas medium: ${neverSeenMedium.length}`);
    console.log(`   📊 Ya respondidas fáciles: ${answeredEasy.length}`);

    let finalSelection = [];
    let selectionStrategy = '';

    if (neverSeenEasy.length >= numQuestions) {
      finalSelection = neverSeenEasy.slice(0, numQuestions);
      selectionStrategy = 'PERFECTO: Solo nunca vistas fáciles';
    } else {
      const combined = [...neverSeenEasy, ...neverSeenMedium];
      if (combined.length >= numQuestions) {
        finalSelection = combined.slice(0, numQuestions);
        selectionStrategy = 'BUENO: Nunca vistas fáciles + medium';
      } else {
        finalSelection = [...combined, ...answeredEasy].slice(0, numQuestions);
        selectionStrategy = 'FALLBACK: Incluye algunas ya respondidas';
      }
    }

    console.log(`✅ ESTRATEGIA: ${selectionStrategy}`);
    console.log(`📊 Selección final: ${finalSelection.length} preguntas`);

    // Analizar composición final
    const finalComposition = {
      neverSeenEasy: finalSelection.filter(q => !answeredQuestionIds.has(q.id) && q.difficulty === 'easy').length,
      neverSeenMedium: finalSelection.filter(q => !answeredQuestionIds.has(q.id) && q.difficulty === 'medium').length,
      answeredEasy: finalSelection.filter(q => answeredQuestionIds.has(q.id) && q.difficulty === 'easy').length
    };

    console.log('📊 COMPOSICIÓN FINAL:');
    console.log(`   👁️ Nunca vistas fáciles: ${finalComposition.neverSeenEasy}`);
    console.log(`   👁️ Nunca vistas medium: ${finalComposition.neverSeenMedium}`);
    console.log(`   🔄 Ya respondidas fáciles: ${finalComposition.answeredEasy}`);

    // 🎯 VEREDICTO
    console.log('\n7️⃣ VEREDICTO:');
    
    const hasRepeatedQuestions = finalComposition.answeredEasy > 0;
    const hasSufficientNeverSeen = (finalComposition.neverSeenEasy + finalComposition.neverSeenMedium) >= numQuestions;

    if (!hasRepeatedQuestions) {
      console.log('🎯 ✅ ÉXITO TOTAL: Sin preguntas repetidas');
      console.log('✅ El usuario verá solo preguntas nunca vistas');
      console.log('✅ La adaptación respeta la priorización');
    } else if (hasSufficientNeverSeen) {
      console.log('🚨 ❌ ERROR: Hay preguntas repetidas cuando no debería');
      console.log('❌ Lógica de priorización fallando');
    } else {
      console.log('⚠️ ACEPTABLE: Preguntas repetidas por falta de opciones');
      console.log('✅ Es el comportamiento esperado como último recurso');
    }

    // Verificar problema específico
    const targetQuestionId = '385ee94b-0d03-471e-baf3-8ee8dd18237b';
    const isTargetInFinal = finalSelection.some(q => q.id === targetQuestionId);
    const wasTargetAnswered = answeredQuestionIds.has(targetQuestionId);
    
    console.log(`\n🔍 VERIFICACIÓN PREGUNTA ESPECÍFICA ${targetQuestionId}:`);
    console.log(`   ¿Estaba en el historial?: ${wasTargetAnswered ? 'SÍ' : 'NO'}`);
    console.log(`   ¿Aparece en selección final?: ${isTargetInFinal ? 'SÍ' : 'NO'}`);
    
    if (wasTargetAnswered && isTargetInFinal) {
      console.log('🚨 ❌ PROBLEMA: Pregunta ya respondida incluida en selección');
    } else if (!wasTargetAnswered && !isTargetInFinal) {
      console.log('🤷 NEUTRAL: Pregunta nunca vista no incluida (normal en selección aleatoria)');
    } else {
      console.log('✅ CORRECTO: Comportamiento esperado');
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

testIntelligentAdaptiveSystem();