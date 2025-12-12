import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const testId = '46df5bc6-adea-4ee1-9bf0-8c44705d92a7'

console.log('🔍 Verificando test ID:', testId)
console.log('')

// 1. Verificar el test en la tabla tests
const { data: testData, error: testError } = await supabase
  .from('tests')
  .select('*')
  .eq('id', testId)
  .single()

if (testError) {
  console.error('❌ Error obteniendo test:', testError)
} else if (!testData) {
  console.error('❌ Test no encontrado')
} else {
  console.log('✅ TEST ENCONTRADO:')
  console.log('  - ID:', testData.id)
  console.log('  - Title:', testData.title)
  console.log('  - Type:', testData.test_type)
  console.log('  - URL:', testData.test_url)
  console.log('  - Total Questions:', testData.total_questions)
  console.log('  - Score:', testData.score)
  console.log('  - Is Completed:', testData.is_completed)
  console.log('  - Started At:', testData.started_at)
  console.log('  - Completed At:', testData.completed_at)
  console.log('  - Total Time (seconds):', testData.total_time_seconds)
  console.log('  - Avg Time per Question:', testData.average_time_per_question)
  console.log('  - Topic ID:', testData.topic_id)
  console.log('')

  // Verificar analytics
  if (testData.detailed_analytics) {
    console.log('✅ ANALYTICS GUARDADOS:')
    const analytics = typeof testData.detailed_analytics === 'string'
      ? JSON.parse(testData.detailed_analytics)
      : testData.detailed_analytics

    console.log('  - Performance Summary:', analytics.performance_summary)
    console.log('  - Difficulty Breakdown:', analytics.difficulty_breakdown?.length || 0, 'items')
    console.log('  - Article Performance:', analytics.article_performance?.length || 0, 'items')
    console.log('  - Improvement Areas:', analytics.improvement_areas?.length || 0, 'items')
  } else {
    console.log('⚠️ No analytics data')
  }
  console.log('')
}

// 2. Verificar las preguntas guardadas
const { data: questions, error: questionsError } = await supabase
  .from('test_questions')
  .select('*')
  .eq('test_id', testId)
  .order('question_order', { ascending: true })

if (questionsError) {
  console.error('❌ Error obteniendo preguntas:', questionsError)
} else {
  console.log(`✅ PREGUNTAS GUARDADAS: ${questions.length}/10`)
  console.log('')

  questions.forEach((q, idx) => {
    console.log(`  Pregunta ${q.question_order}:`)
    console.log(`    - Question ID: ${q.question_id}`)
    console.log(`    - Article: ${q.article_number} (${q.law_name})`)
    console.log(`    - User Answer: ${q.user_answer}`)
    console.log(`    - Correct Answer: ${q.correct_answer}`)
    console.log(`    - Is Correct: ${q.is_correct}`)
    console.log(`    - Confidence: ${q.confidence_level}`)
    console.log(`    - Time Spent: ${q.time_spent_seconds}s`)
    console.log(`    - Difficulty: ${q.difficulty}`)
    console.log('')
  })

  // Estadísticas
  const correctCount = questions.filter(q => q.is_correct).length
  const incorrectCount = questions.filter(q => !q.is_correct).length

  console.log('📊 ESTADÍSTICAS:')
  console.log(`  - Correctas: ${correctCount}`)
  console.log(`  - Incorrectas: ${incorrectCount}`)
  console.log(`  - Total: ${questions.length}`)
  console.log('')
}

// 3. Verificar que topic_id esté presente (para user_progress)
if (testData && testData.topic_id) {
  console.log('✅ Topic ID presente:', testData.topic_id)

  // Verificar si se actualizó user_progress
  const { data: progressData, error: progressError } = await supabase
    .from('user_progress')
    .select('*')
    .eq('topic_id', testData.topic_id)
    .eq('user_id', testData.user_id)
    .single()

  if (progressError) {
    if (progressError.code === 'PGRST116') {
      console.log('⚠️ No existe registro en user_progress para este tema')
    } else {
      console.error('❌ Error verificando user_progress:', progressError)
    }
  } else {
    console.log('✅ USER_PROGRESS ENCONTRADO:')
    console.log('  - Total Attempts:', progressData.total_attempts)
    console.log('  - Correct Attempts:', progressData.correct_attempts)
    console.log('  - Accuracy:', progressData.accuracy_percentage + '%')
    console.log('  - Last Attempt:', progressData.last_attempt_date)
  }
} else {
  console.log('⚠️ Topic ID no presente - user_progress no se actualizará')
}

console.log('')
console.log('🎯 VERIFICACIÓN COMPLETA')
