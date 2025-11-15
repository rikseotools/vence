// scripts/debug-question-selection-algorithm.js
// Script para debuggear el algoritmo de selección de preguntas en producción

import { getSupabaseClient } from '../lib/supabase.js'

const supabase = getSupabaseClient()

// Función para simular exactamente el algoritmo de fetchPersonalizedQuestions
async function debugQuestionSelection(tema, userId, numQuestions = 25) {
  try {
    console.log(`🔍 DEBUGGING QUESTION SELECTION FOR USER: ${userId}`)
    console.log(`📚 Tema: ${tema}, Preguntas solicitadas: ${numQuestions}`)
    console.log('=' .repeat(80))
    
    // PASO 1: Obtener historial de respuestas del usuario
    console.log('🔍 PASO 1: Obteniendo historial de respuestas...')
    
    const { data: userAnswers, error: answersError } = await supabase
      .from('test_questions')
      .select(`
        question_id, 
        created_at, 
        tests!inner(user_id)
      `)
      .eq('tests.user_id', userId)
      .order('created_at', { ascending: false })

    if (answersError) {
      console.error('❌ Error obteniendo historial:', answersError.message)
      return
    }

    console.log(`📊 Total respuestas en test_questions: ${userAnswers?.length || 0}`)
    
    // Crear Maps para clasificación
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
      
      console.log(`📝 Preguntas únicas respondidas: ${answeredQuestionIds.size}`)
      console.log('📝 Últimas 10 preguntas respondidas:')
      Array.from(answeredQuestionIds).slice(0, 10).forEach((id, index) => {
        const lastDate = questionLastAnswered.get(id)
        console.log(`   ${index + 1}. ${id} - ${lastDate.toLocaleDateString()}`)
      })
    }

    // PASO 2: Obtener preguntas del tema
    console.log('\n🔍 PASO 2: Obteniendo preguntas del tema...')
    
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

    if (questionsError) {
      console.error('❌ Error obteniendo preguntas:', questionsError.message)
      return
    }

    console.log(`📚 Total preguntas disponibles para Ley 19/2013: ${allQuestions?.length || 0}`)

    if (!allQuestions || allQuestions.length === 0) {
      console.log('❌ No se encontraron preguntas para esta ley')
      return
    }

    // PASO 3: Clasificar preguntas
    console.log('\n🔍 PASO 3: Clasificando preguntas por prioridad...')
    
    const neverSeenQuestions = []
    const answeredQuestions = []
    
    allQuestions.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        question._lastAnswered = questionLastAnswered.get(question.id)
        answeredQuestions.push(question)
      } else {
        neverSeenQuestions.push(question)
      }
    })

    // Ordenar respondidas por fecha (más antiguas primero)
    answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)

    console.log(`✅ CLASIFICACIÓN COMPLETADA:`)
    console.log(`   📚 Preguntas nunca vistas: ${neverSeenQuestions.length}`)
    console.log(`   📚 Preguntas ya respondidas: ${answeredQuestions.length}`)

    // PASO 4: Aplicar algoritmo de selección
    console.log('\n🔍 PASO 4: Aplicando algoritmo de selección...')

    let selectedQuestions = []
    
    if (neverSeenQuestions.length >= numQuestions) {
      console.log('🎯 ESTRATEGIA: Solo preguntas nunca vistas')
      selectedQuestions = neverSeenQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, numQuestions)
    } else {
      console.log('🎯 ESTRATEGIA: Distribución mixta')
      const neverSeenCount = neverSeenQuestions.length
      const reviewCount = numQuestions - neverSeenCount
      
      console.log(`   📊 ${neverSeenCount} nunca vistas + ${reviewCount} para repaso`)
      
      const shuffledNeverSeen = neverSeenQuestions.sort(() => Math.random() - 0.5)
      const oldestForReview = answeredQuestions.slice(0, reviewCount)
      
      selectedQuestions = [...shuffledNeverSeen, ...oldestForReview]
    }

    // PASO 5: Verificación final
    console.log('\n🔍 PASO 5: Verificación final de la selección...')
    console.log(`✅ Preguntas seleccionadas: ${selectedQuestions.length}`)

    // Analizar la selección
    let neverSeenInSelection = 0
    let alreadyAnsweredInSelection = 0

    console.log('\n📝 ANÁLISIS DE LA SELECCIÓN:')
    selectedQuestions.forEach((question, index) => {
      const wasAnswered = answeredQuestionIds.has(question.id)
      const status = wasAnswered ? '🟡 YA VISTA' : '🟢 NUNCA VISTA'
      const lastAnswered = wasAnswered ? questionLastAnswered.get(question.id)?.toLocaleDateString() : 'N/A'
      
      console.log(`   ${index + 1}. ${question.id} - ${status} - Última respuesta: ${lastAnswered}`)
      console.log(`      Pregunta: "${question.question_text.substring(0, 60)}..."`)
      
      if (wasAnswered) {
        alreadyAnsweredInSelection++
      } else {
        neverSeenInSelection++
      }
    })

    console.log('\n📊 RESUMEN FINAL:')
    console.log(`   🟢 Nunca vistas en selección: ${neverSeenInSelection}`)
    console.log(`   🟡 Ya respondidas en selección: ${alreadyAnsweredInSelection}`)
    console.log(`   ⚖️ Ratio nunca vistas: ${((neverSeenInSelection / selectedQuestions.length) * 100).toFixed(1)}%`)

    // ALERTA si hay problema
    if (neverSeenQuestions.length > 0 && neverSeenInSelection === 0) {
      console.log('\n🚨 PROBLEMA DETECTADO:')
      console.log('   ❌ Hay preguntas nunca vistas disponibles pero no se seleccionaron')
      console.log('   ❌ El algoritmo NO está funcionando correctamente')
    } else if (neverSeenInSelection < neverSeenQuestions.length && neverSeenInSelection < numQuestions) {
      console.log('\n⚠️ POSIBLE PROBLEMA:')
      console.log('   🔶 No se priorizaron todas las preguntas nunca vistas disponibles')
    } else {
      console.log('\n✅ ALGORITMO FUNCIONANDO CORRECTAMENTE')
    }

    // Verificar también en detailed_answers por si hay inconsistencias
    console.log('\n🔍 VERIFICACIÓN ADICIONAL: Revisando detailed_answers...')
    
    const { data: detailedAnswers, error: detailedError } = await supabase
      .from('detailed_answers')
      .select('question_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!detailedError && detailedAnswers) {
      const detailedAnsweredIds = new Set(detailedAnswers.map(a => a.question_id))
      console.log(`📊 Total respuestas en detailed_answers: ${detailedAnswers.length}`)
      
      // Comparar con test_questions
      const onlyInTestQuestions = [...answeredQuestionIds].filter(id => !detailedAnsweredIds.has(id))
      const onlyInDetailedAnswers = [...detailedAnsweredIds].filter(id => !answeredQuestionIds.has(id))
      
      if (onlyInTestQuestions.length > 0 || onlyInDetailedAnswers.length > 0) {
        console.log('🚨 INCONSISTENCIA DETECTADA entre sistemas:')
        console.log(`   📊 Solo en test_questions: ${onlyInTestQuestions.length}`)
        console.log(`   📊 Solo en detailed_answers: ${onlyInDetailedAnswers.length}`)
        
        if (onlyInTestQuestions.length > 0) {
          console.log('   IDs solo en test_questions:', onlyInTestQuestions.slice(0, 5))
        }
        if (onlyInDetailedAnswers.length > 0) {
          console.log('   IDs solo en detailed_answers:', onlyInDetailedAnswers.slice(0, 5))
        }
      } else {
        console.log('✅ Ambos sistemas están sincronizados')
      }
    }

    return {
      totalQuestions: allQuestions.length,
      neverSeenCount: neverSeenQuestions.length,
      answeredCount: answeredQuestions.length,
      selectedCount: selectedQuestions.length,
      neverSeenInSelection,
      alreadyAnsweredInSelection,
      selectedQuestions
    }

  } catch (error) {
    console.error('❌ Error en debug:', error.message)
    console.error(error.stack)
  }
}

// Ejecutar debug con datos reales
async function runDebug() {
  try {
    // Buscar un usuario real para testing
    console.log('🔍 Buscando usuario para testing...')
    
    const { data: users, error } = await supabase
      .from('user_profiles')
      .select('id, email')
      .limit(5)

    if (error || !users || users.length === 0) {
      console.log('❌ No se pudieron obtener usuarios de prueba')
      console.log('💡 Usa: node scripts/debug-question-selection-algorithm.js [user-id]')
      return
    }

    console.log('👥 Usuarios disponibles:')
    users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.id} (${user.email})`)
    })

    // Usar el primer usuario o el especificado por parámetro
    const targetUserId = process.argv[2] || users[0].id
    console.log(`\n🎯 Usando usuario: ${targetUserId}`)

    await debugQuestionSelection('7', targetUserId, 25)

  } catch (error) {
    console.error('❌ Error ejecutando debug:', error.message)
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runDebug()
}

export { debugQuestionSelection };