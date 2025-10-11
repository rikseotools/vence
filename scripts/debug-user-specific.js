// scripts/debug-user-specific.js
// Debug específico para el usuario actual
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugUserSpecific() {
  try {
    console.log('🔍 Debugging for specific user...')

    // Usuario que probablemente eres tú
    const userId = '2fc60bc8-c5b6-47ff-a4bb-0a88e4b36ba3'
    
    // 1. Obtener preguntas disponibles
    const { data: availableQuestions, error: questionsError } = await supabase
      .from('psychometric_questions')
      .select(`
        id, question_text, question_subtype, created_at,
        psychometric_categories!inner(category_key),
        psychometric_sections!inner(section_key)
      `)
      .eq('psychometric_categories.category_key', 'capacidad-administrativa')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (questionsError) {
      console.error('❌ Error:', questionsError)
      return
    }

    console.log(`\n📊 Available questions: ${availableQuestions.length}`)
    availableQuestions.forEach((q, i) => {
      console.log(`  ${i+1}. ${q.id.substring(0, 8)}... - ${q.question_subtype} - "${q.question_text.substring(0, 50)}..."`)
    })

    // 2. Obtener historial del usuario
    const { data: userAnswers, error: answersError } = await supabase
      .from('psychometric_test_answers')
      .select('question_id, created_at, is_correct')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    console.log(`\n📋 User answer history: ${userAnswers?.length || 0} answers`)
    if (userAnswers && userAnswers.length > 0) {
      userAnswers.forEach((a, i) => {
        const correct = a.is_correct ? '✅' : '❌'
        console.log(`  ${i+1}. ${correct} ${a.question_id.substring(0, 8)}... - ${new Date(a.created_at).toLocaleString()}`)
      })
    }

    // 3. Aplicar exactamente el mismo algoritmo que usa selectAdaptiveQuestions
    const answeredQuestionIds = new Set()
    const questionLastAnswered = new Map()
    
    if (userAnswers) {
      userAnswers.forEach(answer => {
        answeredQuestionIds.add(answer.question_id)
        const answerDate = new Date(answer.created_at)
        
        if (!questionLastAnswered.has(answer.question_id) || 
            answerDate > questionLastAnswered.get(answer.question_id)) {
          questionLastAnswered.set(answer.question_id, answerDate)
        }
      })
    }
    
    const neverSeenQuestions = []
    const answeredQuestions = []
    
    availableQuestions.forEach(question => {
      if (answeredQuestionIds.has(question.id)) {
        question._lastAnswered = questionLastAnswered.get(question.id)
        answeredQuestions.push(question)
      } else {
        neverSeenQuestions.push(question)
      }
    })
    
    // Ordenar por fecha (más antiguas primero)
    answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)
    
    console.log(`\n🎯 CLASSIFICATION:`)
    console.log(`- Never seen: ${neverSeenQuestions.length}`)
    console.log(`- Already answered: ${answeredQuestions.length}`)
    
    console.log(`\n✨ NEVER SEEN QUESTIONS (should appear FIRST):`)
    neverSeenQuestions.forEach((q, i) => {
      console.log(`  ${i+1}. [NEVER] ${q.id.substring(0, 8)}... - ${q.question_subtype} - "${q.question_text.substring(0, 60)}..."`)
    })
    
    console.log(`\n🔄 ALREADY ANSWERED (oldest first):`)
    answeredQuestions.forEach((q, i) => {
      console.log(`  ${i+1}. [SEEN] ${q.id.substring(0, 8)}... - ${new Date(q._lastAnswered).toLocaleString()} - "${q.question_text.substring(0, 60)}..."`)
    })
    
    // Resultado final que debería ver el usuario
    const finalOrder = [...neverSeenQuestions, ...answeredQuestions]
    
    console.log(`\n📋 FINAL ORDER (what user should see):`)
    finalOrder.forEach((q, i) => {
      const status = answeredQuestionIds.has(q.id) ? 
        `[SEEN ${new Date(q._lastAnswered).toLocaleDateString()}]` : 
        '[NEVER SEEN]'
      console.log(`  ${i+1}. ${status} "${q.question_text.substring(0, 80)}..."`)
    })

    console.log(`\n🎯 EXPECTED BEHAVIOR:`)
    if (neverSeenQuestions.length > 0) {
      console.log(`❗ User should see NEVER SEEN questions first!`)
      console.log(`❗ First question should be: "${neverSeenQuestions[0].question_text.substring(0, 80)}..."`)
    } else {
      console.log(`❗ User should see oldest answered questions first`)
      console.log(`❗ First question should be: "${answeredQuestions[0].question_text.substring(0, 80)}..."`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugUserSpecific()