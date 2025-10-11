// scripts/delete-bar-chart-question-v2.js
// Script para borrar la pregunta y sus respuestas asociadas
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function deleteBarChartQuestionAndAnswers() {
  try {
    console.log('🗑️ Deleting bar chart question and related data...')

    const questionId = 'c0a4375f-9933-4ed6-8a4e-e0d32c540618'

    // 1. Primero borrar respuestas asociadas
    console.log('📋 Deleting associated answers...')
    const { data: deletedAnswers, error: answersError } = await supabase
      .from('psychometric_test_answers')
      .delete()
      .eq('question_id', questionId)
      .select('id')

    if (answersError) {
      console.error('❌ Error deleting answers:', answersError)
      return
    }

    console.log(`✅ Deleted ${deletedAnswers?.length || 0} associated answers`)

    // 2. Luego borrar la pregunta
    console.log('📝 Deleting question...')
    const { data: deletedQuestion, error: questionError } = await supabase
      .from('psychometric_questions')
      .delete()
      .eq('id', questionId)
      .select()

    if (questionError) {
      console.error('❌ Error deleting question:', questionError)
      return
    }

    if (deletedQuestion && deletedQuestion.length > 0) {
      console.log('✅ Question deleted successfully!')
      console.log('📋 Deleted question ID:', deletedQuestion[0].id)
      console.log('📝 Question text:', deletedQuestion[0].question_text)
    } else {
      console.log('⚠️ No question found with that ID')
    }

    console.log('🎉 Cleanup completed successfully!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Ejecutar el script
deleteBarChartQuestionAndAnswers()