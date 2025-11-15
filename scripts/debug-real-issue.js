// scripts/debug-real-issue.js
// Debug profundo para encontrar el fallo real

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabaseClient } from '../lib/supabase.js'

const supabase = getSupabaseClient()

// Debug real con datos de producción
async function debugRealIssue() {
  try {
    console.log('🔍 DEBUGGING REAL ISSUE - DATOS DE PRODUCCIÓN')
    console.log('='.repeat(60))
    
    // Buscar usuarios activos recientes
    console.log('👥 Buscando usuarios activos...')
    const { data: recentUsers, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, email, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (usersError) {
      console.error('❌ Error obteniendo usuarios:', usersError.message)
      return
    }
    
    if (!recentUsers || recentUsers.length === 0) {
      console.log('❌ No se encontraron usuarios')
      return
    }
    
    console.log(`✅ Encontrados ${recentUsers.length} usuarios recientes`)
    
    // Analizar cada usuario
    for (const user of recentUsers.slice(0, 3)) {
      await analyzeUserQuestionFlow(user)
    }
    
  } catch (error) {
    console.error('❌ Error en debug:', error.message)
  }
}

async function analyzeUserQuestionFlow(user) {
  console.log(`\n🔍 ANALIZANDO USUARIO: ${user.email}`)
  console.log('_'.repeat(50))
  
  try {
    // 1. Obtener historial real del usuario en test_questions
    console.log('📊 PASO 1: Historial en test_questions...')
    const { data: testQuestions, error: testError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at,
        question_text,
        tests!inner(user_id, created_at as test_created_at)
      `)
      .eq('tests.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (testError) {
      console.log(`❌ Error historial test_questions: ${testError.message}`)
      return
    }
    
    console.log(`📊 Total respuestas en test_questions: ${testQuestions?.length || 0}`)
    
    if (testQuestions && testQuestions.length > 0) {
      console.log('📝 Últimas 5 preguntas respondidas:')
      testQuestions.slice(0, 5).forEach((tq, i) => {
        console.log(`   ${i + 1}. ${tq.question_id} - ${new Date(tq.created_at).toLocaleString()}`)
        console.log(`      "${tq.question_text?.substring(0, 60)}..."`)
      })
      
      // Detectar posibles duplicados en el historial
      const questionIds = testQuestions.map(tq => tq.question_id)
      const uniqueIds = new Set(questionIds)
      
      if (uniqueIds.size !== questionIds.length) {
        console.log('🚨 DUPLICADOS EN HISTORIAL DETECTADOS!')
        const duplicates = questionIds.filter((id, index) => questionIds.indexOf(id) !== index)
        console.log(`   IDs duplicados: ${duplicates.slice(0, 5).join(', ')}`)
      }
    }
    
    // 2. Verificar si hay detailed_answers también
    console.log('\n📊 PASO 2: Comparar con detailed_answers...')
    const { data: detailedAnswers, error: detailedError } = await supabase
      .from('detailed_answers')
      .select('question_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (!detailedError && detailedAnswers) {
      console.log(`📊 Total respuestas en detailed_answers: ${detailedAnswers.length}`)
      
      const testQIds = new Set((testQuestions || []).map(tq => tq.question_id))
      const detailedQIds = new Set(detailedAnswers.map(da => da.question_id))
      
      const onlyInTest = [...testQIds].filter(id => !detailedQIds.has(id))
      const onlyInDetailed = [...detailedQIds].filter(id => !testQIds.has(id))
      
      if (onlyInTest.length > 0 || onlyInDetailed.length > 0) {
        console.log('⚠️ INCONSISTENCIA entre sistemas:')
        console.log(`   Solo en test_questions: ${onlyInTest.length}`)
        console.log(`   Solo en detailed_answers: ${onlyInDetailed.length}`)
      } else {
        console.log('✅ Sistemas consistentes')
      }
    }
    
    // 3. Verificar preguntas disponibles para Ley 19/2013
    console.log('\n📊 PASO 3: Preguntas disponibles Ley 19/2013...')
    const { data: availableQuestions, error: questionsError } = await supabase
      .from('questions')
      .select(`
        id, question_text, is_active,
        articles!inner(
          laws!inner(short_name)
        )
      `)
      .eq('articles.laws.short_name', 'Ley 19/2013')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    
    if (questionsError) {
      console.log(`❌ Error preguntas disponibles: ${questionsError.message}`)
      return
    }
    
    console.log(`📊 Preguntas activas Ley 19/2013: ${availableQuestions?.length || 0}`)
    
    if (!availableQuestions || availableQuestions.length === 0) {
      console.log('❌ No hay preguntas de Ley 19/2013 - ESO EXPLICA EL PROBLEMA!')
      return
    }
    
    // 4. Simular el algoritmo actual paso a paso
    console.log('\n📊 PASO 4: Simulando algoritmo actual...')
    const answeredIds = new Set((testQuestions || []).map(tq => tq.question_id))
    const neverSeen = availableQuestions.filter(q => !answeredIds.has(q.id))
    
    console.log(`📊 Clasificación:`)
    console.log(`   Total disponibles: ${availableQuestions.length}`)
    console.log(`   Ya respondidas: ${answeredIds.size}`)
    console.log(`   Nunca vistas: ${neverSeen.length}`)
    
    // 5. Detectar el problema real
    if (neverSeen.length > 0) {
      console.log('✅ HAY preguntas nunca vistas disponibles')
      console.log('🎯 Si el usuario ve repetidas, el problema es OTRO')
      
      // Verificar IDs específicos
      console.log('\n🔍 VERIFICANDO IDs específicos...')
      const sampleAnsweredIds = Array.from(answeredIds).slice(0, 3)
      
      for (const answeredId of sampleAnsweredIds) {
        const existsInAvailable = availableQuestions.some(q => q.id === answeredId)
        console.log(`   ${answeredId}: ${existsInAvailable ? '✅ Existe' : '❌ NO existe'} en disponibles`)
        
        if (!existsInAvailable) {
          console.log('🚨 PROBLEMA ENCONTRADO: ID en historial no existe en preguntas disponibles')
        }
      }
      
    } else {
      console.log('⚠️ NO hay preguntas nunca vistas - usuario agotó todas las preguntas')
      console.log('💡 Comportamiento esperado: ver preguntas más antiguas')
    }
    
    // 6. Verificar joins y filtros
    console.log('\n📊 PASO 5: Verificando queries complejas...')
    
    // Query tal como la haría fetchPersonalizedQuestions
    const { data: queryTest, error: queryError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id)
      `)
      .eq('tests.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (!queryError && queryTest) {
      console.log(`📊 Query completa funciona: ${queryTest.length} resultados`)
      
      // Verificar si algún question_id no existe
      const queryIds = queryTest.map(qt => qt.question_id)
      let invalidIds = 0
      
      for (const qid of queryIds) {
        const { data: exists } = await supabase
          .from('questions')
          .select('id')
          .eq('id', qid)
          .single()
        
        if (!exists) {
          console.log(`❌ ID ${qid} en historial NO existe en tabla questions`)
          invalidIds++
        }
      }
      
      if (invalidIds > 0) {
        console.log(`🚨 PROBLEMA CRÍTICO: ${invalidIds} IDs inválidos en historial`)
      } else {
        console.log('✅ Todos los IDs del historial son válidos')
      }
    }
    
  } catch (error) {
    console.error(`❌ Error analizando usuario ${user.email}:`, error.message)
  }
}

// Debug específico de la función fetchPersonalizedQuestions
async function debugFetchPersonalizedQuestions() {
  console.log('\n🔍 DEBUGGING fetchPersonalizedQuestions REAL')
  console.log('='.repeat(60))
  
  try {
    // Obtener un usuario real
    const { data: users } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)
    
    if (!users || users.length === 0) {
      console.log('❌ No hay usuarios para testing')
      return
    }
    
    const userId = users[0].id
    console.log(`🎯 Testing con usuario: ${userId}`)
    
    // Simular exactamente lo que hace fetchPersonalizedQuestions
    console.log('\n📊 Paso 1: Query de preguntas...')
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
      .order('created_at', { ascending: false })
    
    console.log(`📊 Preguntas obtenidas: ${allQuestions?.length || 0}`)
    if (questionsError) {
      console.log('❌ Error:', questionsError.message)
    }
    
    console.log('\n📊 Paso 2: Query de historial...')
    const { data: userAnswers, error: answersError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id)
      `)
      .eq('tests.user_id', userId)
      .order('created_at', { ascending: false })
    
    console.log(`📊 Historial obtenido: ${userAnswers?.length || 0}`)
    if (answersError) {
      console.log('❌ Error:', answersError.message)
    }
    
    if (allQuestions && userAnswers) {
      console.log('\n📊 Paso 3: Algoritmo de clasificación...')
      
      const answeredIds = new Set(userAnswers.map(ua => ua.question_id))
      const neverSeen = allQuestions.filter(q => !answeredIds.has(q.id))
      const alreadyAnswered = allQuestions.filter(q => answeredIds.has(q.id))
      
      console.log(`📊 Total disponibles: ${allQuestions.length}`)
      console.log(`📊 En historial: ${answeredIds.size}`)
      console.log(`📊 Nunca vistas: ${neverSeen.length}`)
      console.log(`📊 Ya respondidas: ${alreadyAnswered.length}`)
      
      // Verificar consistencia
      if (neverSeen.length + alreadyAnswered.length !== allQuestions.length) {
        console.log('🚨 INCONSISTENCIA: Los números no cuadran!')
        console.log(`   ${neverSeen.length} + ${alreadyAnswered.length} ≠ ${allQuestions.length}`)
      }
      
      // Si hay problema, mostrar ejemplos
      if (neverSeen.length < allQuestions.length - answeredIds.size) {
        console.log('\n🔍 Analizando discrepancia...')
        
        // Buscar preguntas que no están en ningún lado
        const allFoundIds = new Set([
          ...neverSeen.map(q => q.id),
          ...alreadyAnswered.map(q => q.id)
        ])
        
        const missingQuestions = allQuestions.filter(q => !allFoundIds.has(q.id))
        
        if (missingQuestions.length > 0) {
          console.log(`🚨 ${missingQuestions.length} preguntas NO clasificadas:`)
          missingQuestions.slice(0, 3).forEach(q => {
            const inHistory = answeredIds.has(q.id)
            console.log(`   ${q.id} - En historial: ${inHistory}`)
          })
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error en debug fetch:', error.message)
  }
}

// Ejecutar debugging completo
async function runCompleteDebug() {
  console.log('🚀 INICIANDO DEBUG PROFUNDO DEL PROBLEMA REAL')
  console.log('='.repeat(70))
  
  await debugRealIssue()
  await debugFetchPersonalizedQuestions()
  
  console.log('\n📊 PRÓXIMOS PASOS PARA DEBUGGING:')
  console.log('1. Ejecuta este script y mira los logs')
  console.log('2. Identifica usuarios con comportamiento anómalo') 
  console.log('3. Busca inconsistencias en IDs o classificación')
  console.log('4. Verifica si el problema es en frontend o backend')
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runCompleteDebug()
}