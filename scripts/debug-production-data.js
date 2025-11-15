// scripts/debug-production-data.js
// Script para análisis directo de datos de producción

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function analyzeProductionData() {
  console.log('🔍 ANÁLISIS DE DATOS DE PRODUCCIÓN - PROBLEMA PREGUNTAS REPETIDAS');
  console.log('='.repeat(70));

  try {
    // 1. Ver usuarios activos recientes
    console.log('\n👥 STEP 1: Verificando usuarios activos...');
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, email, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (usersError) {
      console.error('❌ Error:', usersError.message);
      return;
    }
    
    console.log(`📊 Total usuarios recientes: ${users?.length || 0}`);
    
    if (!users || users.length === 0) {
      console.log('❌ No se encontraron usuarios - verificando tabla...');
      
      // Verificar si la tabla existe
      const { data: tablesCheck } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'user_profiles')
        .single();
      
      console.log('📋 Tabla user_profiles existe:', !!tablesCheck);
      return;
    }

    // 2. Análisis de test_questions para detectar duplicados
    console.log('\n📊 STEP 2: Analizando historial de test_questions...');
    
    const targetUser = users[0];
    console.log(`🎯 Analizando usuario: ${targetUser.email}`);

    const { data: testQuestions, error: testError } = await supabase
      .from('test_questions')
      .select(`
        question_id,
        created_at,
        tests!inner(user_id)
      `)
      .eq('tests.user_id', targetUser.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (testError) {
      console.error('❌ Error en test_questions:', testError.message);
      return;
    }

    console.log(`📊 Total respuestas del usuario: ${testQuestions?.length || 0}`);
    
    if (testQuestions && testQuestions.length > 0) {
      // Análisis de duplicados
      const questionIds = testQuestions.map(tq => tq.question_id);
      const uniqueIds = new Set(questionIds);
      const totalAnswers = questionIds.length;
      const uniqueAnswers = uniqueIds.size;
      
      console.log(`📊 Respuestas únicas: ${uniqueAnswers}`);
      console.log(`📊 Respuestas totales: ${totalAnswers}`);
      console.log(`📊 Duplicados: ${totalAnswers - uniqueAnswers}`);
      
      if (uniqueAnswers < totalAnswers) {
        console.log('🚨 DUPLICADOS DETECTADOS EN HISTORIAL!');
        
        // Encontrar cuáles están duplicados
        const duplicates = questionIds.filter((id, index) => 
          questionIds.indexOf(id) !== index
        );
        
        console.log(`📝 IDs duplicados (primeros 10): ${duplicates.slice(0, 10).join(', ')}`);
        
        // Análizar frecuencia
        const frequency = {};
        questionIds.forEach(id => {
          frequency[id] = (frequency[id] || 0) + 1;
        });
        
        const mostFrequent = Object.entries(frequency)
          .filter(([_, count]) => count > 1)
          .sort(([_, a], [__, b]) => b - a)
          .slice(0, 5);
        
        console.log('\n🔥 Preguntas más repetidas:');
        mostFrequent.forEach(([id, count]) => {
          console.log(`   ${id}: ${count} veces`);
        });
      }
      
      // 3. Verificar preguntas disponibles vs historial
      console.log('\n📊 STEP 3: Verificando preguntas disponibles...');
      
      const { data: availableQuestions, error: questionsError } = await supabase
        .from('questions')
        .select(`
          id, 
          question_text,
          is_active,
          articles!inner(
            laws!inner(short_name)
          )
        `)
        .eq('articles.laws.short_name', 'Ley 19/2013')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (questionsError) {
        console.error('❌ Error en questions:', questionsError.message);
        return;
      }
      
      console.log(`📊 Preguntas disponibles Ley 19/2013: ${availableQuestions?.length || 0}`);
      
      if (availableQuestions && availableQuestions.length > 0) {
        const answeredIds = new Set(questionIds);
        const neverSeen = availableQuestions.filter(q => !answeredIds.has(q.id));
        
        console.log(`📊 Preguntas nunca vistas: ${neverSeen.length}`);
        console.log(`📊 Preguntas ya respondidas: ${answeredIds.size}`);
        
        // 4. Detectar inconsistencias críticas
        console.log('\n🔍 STEP 4: Detectando inconsistencias críticas...');
        
        const availableIds = new Set(availableQuestions.map(q => q.id));
        const invalidHistoryIds = questionIds.filter(id => !availableIds.has(id));
        
        if (invalidHistoryIds.length > 0) {
          console.log('🚨 PROBLEMA CRÍTICO: IDs en historial que NO existen en preguntas disponibles');
          console.log(`📊 IDs inválidos: ${invalidHistoryIds.length}`);
          console.log(`📝 Ejemplos: ${invalidHistoryIds.slice(0, 5).join(', ')}`);
          
          console.log('\n🔍 Este es probable la causa del problema:');
          console.log('   1. El historial contiene IDs que ya no existen');
          console.log('   2. El algoritmo no los filtra correctamente');
          console.log('   3. Resultado: calcula mal las "nunca vistas"');
        }
        
        // 5. Simular el algoritmo actual
        console.log('\n📊 STEP 5: Simulando algoritmo actual...');
        
        // Filtro como en fetchPersonalizedQuestions actual
        const answeredIdsFiltered = new Set(
          questionIds.filter(id => availableIds.has(id))
        );
        
        const neverSeenFixed = availableQuestions.filter(q => 
          !answeredIdsFiltered.has(q.id)
        );
        
        console.log(`📊 Con filtro correcto:`);
        console.log(`   - Historial válido: ${answeredIdsFiltered.size}`);
        console.log(`   - Nunca vistas: ${neverSeenFixed.length}`);
        
        if (neverSeenFixed.length !== neverSeen.length) {
          console.log('🎯 DIFERENCIA DETECTADA - Esta podría ser la causa');
          console.log(`   Sin filtro: ${neverSeen.length} nunca vistas`);
          console.log(`   Con filtro: ${neverSeenFixed.length} nunca vistas`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

// Análisis específico de fetchPersonalizedQuestions
async function debugFetchPersonalizedQuestions() {
  console.log('\n🔧 DEBUGGING fetchPersonalizedQuestions CON DATOS REALES');
  console.log('='.repeat(60));
  
  try {
    // Usar usuario real
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1);
    
    if (!users || users.length === 0) {
      console.log('❌ No hay usuarios para testing');
      return;
    }
    
    const userId = users[0].id;
    console.log(`🎯 Testing fetchPersonalizedQuestions con usuario: ${userId}`);
    
    // Reproducir exactamente el código de fetchPersonalizedQuestions
    console.log('\n📊 Ejecutando query de preguntas...');
    const { data: allQuestions, error: questionsError } = await supabase
      .from('questions')
      .select(`
        id, question_text, option_a, option_b, option_c, option_d,
        correct_option, explanation, difficulty, question_type, tags,
        primary_article_id, is_official_exam, exam_source, exam_date,
        exam_entity, official_difficulty_level, is_active, created_at, updated_at,
        articles!inner(
          id, article_number, title, content,
          laws!inner(id, short_name, name)
        )
      `)
      .eq('articles.laws.short_name', 'Ley 19/2013')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    console.log(`📊 Preguntas obtenidas: ${allQuestions?.length || 0}`);
    if (questionsError) {
      console.error('❌ Error:', questionsError.message);
      return;
    }
    
    console.log('\n📊 Ejecutando query de historial...');
    const { data: userAnswers, error: answersError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id)
      `)
      .eq('tests.user_id', userId)
      .order('created_at', { ascending: false });
    
    console.log(`📊 Historial obtenido: ${userAnswers?.length || 0}`);
    if (answersError) {
      console.error('❌ Error:', answersError.message);
      return;
    }
    
    if (allQuestions && userAnswers) {
      console.log('\n📊 Aplicando algoritmo de clasificación...');
      
      const answeredIds = new Set(userAnswers.map(ua => ua.question_id));
      const neverSeen = allQuestions.filter(q => !answeredIds.has(q.id));
      const alreadyAnswered = allQuestions.filter(q => answeredIds.has(q.id));
      
      console.log(`📊 Total disponibles: ${allQuestions.length}`);
      console.log(`📊 En historial (raw): ${answeredIds.size}`);
      console.log(`📊 Nunca vistas: ${neverSeen.length}`);
      console.log(`📊 Ya respondidas: ${alreadyAnswered.length}`);
      
      // Verificación crítica
      const expectedTotal = neverSeen.length + alreadyAnswered.length;
      if (expectedTotal !== allQuestions.length) {
        console.log('🚨 INCONSISTENCIA MATEMÁTICA DETECTADA!');
        console.log(`   ${neverSeen.length} + ${alreadyAnswered.length} = ${expectedTotal}`);
        console.log(`   Debería ser: ${allQuestions.length}`);
        console.log('   Diferencia:', allQuestions.length - expectedTotal);
        
        // Buscar la causa
        const allFoundIds = new Set([
          ...neverSeen.map(q => q.id),
          ...alreadyAnswered.map(q => q.id)
        ]);
        
        const missingQuestions = allQuestions.filter(q => !allFoundIds.has(q.id));
        console.log(`🚨 Preguntas NO clasificadas: ${missingQuestions.length}`);
        
        if (missingQuestions.length > 0) {
          missingQuestions.slice(0, 3).forEach(q => {
            const inHistory = answeredIds.has(q.id);
            console.log(`   ${q.id.slice(0, 8)}... - En historial: ${inHistory}`);
          });
        }
      }
      
      // Test específico: ¿Qué pasa si el usuario solicita 25 preguntas?
      const requestedCount = 25;
      let selectedQuestions = [];
      
      if (neverSeen.length >= requestedCount) {
        selectedQuestions = neverSeen.slice(0, requestedCount);
        console.log(`\n✅ ESCENARIO: ${selectedQuestions.length} preguntas nunca vistas seleccionadas`);
        
        // Verificación: ¿alguna ya fue respondida?
        const verificationFailed = selectedQuestions.some(q => answeredIds.has(q.id));
        if (verificationFailed) {
          console.log('🚨 BUG CONFIRMADO: Se seleccionaron preguntas ya vistas!');
          selectedQuestions.forEach(q => {
            if (answeredIds.has(q.id)) {
              console.log(`   ❌ ${q.id} - Ya respondida`);
            }
          });
        } else {
          console.log('✅ Verificación OK: Todas nunca vistas');
        }
      } else {
        console.log(`\n⚠️ ESCENARIO: Solo ${neverSeen.length} nunca vistas, necesita repaso`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error en debug fetchPersonalizedQuestions:', error.message);
  }
}

async function runCompleteAnalysis() {
  await analyzeProductionData();
  await debugFetchPersonalizedQuestions();
  
  console.log('\n📋 CONCLUSIONES Y PRÓXIMOS PASOS');
  console.log('='.repeat(40));
  console.log('1. ✅ Verificar datos de producción');
  console.log('2. 🔍 Identificar duplicados en historial');
  console.log('3. 🎯 Detectar IDs inválidos');
  console.log('4. 🔧 Simular algoritmo real');
  console.log('5. 🚨 Confirmar o descartar bug');
}

runCompleteAnalysis();