// scripts/debug-question-order.js
// Script para debuggear el orden real de las preguntas psicotécnicas
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugQuestionOrder() {
  try {
    console.log('🔍 Debugging question order for psychometric tests...')

    // Simular el proceso exacto que hace el componente
    const testUserId = 'test-user-id' // Usar un ID de usuario real si tienes

    // 1. Obtener preguntas disponibles (igual que en el componente)
    const { data: availableQuestions, error: questionsError } = await supabase
      .from('psychometric_questions')
      .select(`
        *,
        psychometric_categories!inner(category_key, display_name),
        psychometric_sections!inner(section_key, display_name)
      `)
      .eq('psychometric_categories.category_key', 'capacidad-administrativa')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (questionsError) {
      console.error('❌ Error getting questions:', questionsError)
      return
    }

    console.log(`\n📊 Found ${availableQuestions.length} questions:`)
    availableQuestions.forEach((q, i) => {
      console.log(`  ${i+1}. ${q.id.substring(0, 8)}... - ${q.question_subtype} - "${q.question_text.substring(0, 50)}..."`)
    })

    // 2. Obtener historial de respuestas del usuario
    const { data: userAnswers, error: answersError } = await supabase
      .from('psychometric_test_answers')
      .select('question_id, created_at')
      .eq('user_id', testUserId)
      .order('created_at', { ascending: false })

    if (answersError) {
      console.error('❌ Error getting user answers:', answersError)
      // Continuar sin historial
    }

    console.log(`\n📋 User answer history: ${userAnswers?.length || 0} answers`)
    if (userAnswers && userAnswers.length > 0) {
      userAnswers.slice(0, 5).forEach((a, i) => {
        console.log(`  ${i+1}. ${a.question_id.substring(0, 8)}... - ${new Date(a.created_at).toLocaleDateString()}`)
      })
    }

    // 3. Aplicar el algoritmo de priorización exacto
    console.log('\n🧠 Applying prioritization algorithm...')
    
    const answeredQuestionIds = new Set()
    const questionLastAnswered = new Map()
    
    if (userAnswers) {
      userAnswers.forEach(answer => {
        answeredQuestionIds.add(answer.question_id)
        const answerDate = new Date(answer.created_at)
        
        // Guardar la fecha más reciente para cada pregunta
        if (!questionLastAnswered.has(answer.question_id) || 
            answerDate > questionLastAnswered.get(answer.question_id)) {
          questionLastAnswered.set(answer.question_id, answerDate)
        }
      })
    }
    
    // Separar preguntas por prioridad
    const neverSeenQuestions = []
    const answeredQuestions = []
    
    availableQuestions.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        // Pregunta ya respondida - agregar fecha para ordenamiento
        question._lastAnswered = questionLastAnswered.get(question.id)
        answeredQuestions.push(question)
      } else {
        // Pregunta nunca vista - máxima prioridad
        neverSeenQuestions.push(question)
      }
    })
    
    // Ordenar preguntas respondidas por fecha (más antiguas primero)
    answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)
    
    console.log(`\n🎯 PRIORITIZATION RESULTS:`)
    console.log(`- Never seen: ${neverSeenQuestions.length}`)
    console.log(`- Already answered: ${answeredQuestions.length}`)
    
    // Mostrar las primeras 10 preguntas nunca vistas
    console.log(`\n✨ NEVER SEEN QUESTIONS (should appear FIRST):`)
    neverSeenQuestions.slice(0, 10).forEach((q, i) => {
      console.log(`  ${i+1}. ${q.id.substring(0, 8)}... - ${q.question_subtype} - "${q.question_text.substring(0, 50)}..."`)
    })
    
    // Mostrar las primeras 5 preguntas ya respondidas (más antiguas)
    console.log(`\n🔄 ALREADY ANSWERED QUESTIONS (oldest first, should appear AFTER never seen):`)
    answeredQuestions.slice(0, 5).forEach((q, i) => {
      console.log(`  ${i+1}. ${q.id.substring(0, 8)}... - ${new Date(q._lastAnswered).toLocaleDateString()} - "${q.question_text.substring(0, 50)}..."`)
    })
    
    // Resultado final
    const finalQuestions = [
      ...neverSeenQuestions,
      ...answeredQuestions
    ]
    
    console.log(`\n📋 FINAL ORDER (first 10 questions that should appear in test):`)
    finalQuestions.slice(0, 10).forEach((q, i) => {
      const status = answeredQuestionIds.has(q.id) ? 
        `[SEEN ${new Date(q._lastAnswered).toLocaleDateString()}]` : 
        '[NEVER SEEN]'
      console.log(`  ${i+1}. ${status} ${q.id.substring(0, 8)}... - "${q.question_text.substring(0, 50)}..."`)
    })

    // Test con un usuario real si está disponible
    console.log('\n🔍 Testing with a real user from the database...')
    const { data: realUsers, error: usersError } = await supabase
      .from('psychometric_test_answers')
      .select('user_id')
      .limit(1)

    if (!usersError && realUsers && realUsers.length > 0) {
      const realUserId = realUsers[0].user_id
      console.log(`Using real user: ${realUserId.substring(0, 8)}...`)
      
      // Repetir análisis con usuario real
      const { data: realUserAnswers, error: realAnswersError } = await supabase
        .from('psychometric_test_answers')
        .select('question_id, created_at')
        .eq('user_id', realUserId)
        .order('created_at', { ascending: false })

      if (!realAnswersError && realUserAnswers) {
        console.log(`\n📊 Real user has ${realUserAnswers.length} answers`)
        
        const realAnsweredIds = new Set(realUserAnswers.map(a => a.question_id))
        const realNeverSeen = availableQuestions.filter(q => !realAnsweredIds.has(q.id))
        const realAnswered = availableQuestions.filter(q => realAnsweredIds.has(q.id))
        
        console.log(`Real user results: ${realNeverSeen.length} never seen, ${realAnswered.length} already seen`)
        
        if (realNeverSeen.length > 0) {
          console.log(`Next questions for this user should be:`)
          realNeverSeen.slice(0, 3).forEach((q, i) => {
            console.log(`  ${i+1}. [NEVER SEEN] "${q.question_text.substring(0, 60)}..."`)
          })
        }
      }
    }

  } catch (error) {
    console.error('❌ Error in debug script:', error)
  }
}

debugQuestionOrder()