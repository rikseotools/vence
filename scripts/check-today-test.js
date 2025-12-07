import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkTodayTest() {
  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'

  console.log('📅 HOY ES:', new Date().toISOString())
  console.log('='.repeat(60))

  // Test de hoy
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  console.log('Buscando tests desde:', today.toISOString())
  console.log('Hasta:', tomorrow.toISOString())

  const { data: todayTests } = await supabase
    .from('tests')
    .select(`
      id,
      created_at,
      total_questions,
      total_correct,
      test_questions (
        id,
        is_correct
      )
    `)
    .eq('user_id', userId)
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString())

  console.log('\n📊 TESTS DE HOY:')
  if (todayTests?.length > 0) {
    todayTests.forEach(test => {
      const questions = test.test_questions || []
      const correct = questions.filter(q => q.is_correct).length

      console.log(`Test ID: ${test.id}`)
      console.log(`  Creado: ${test.created_at}`)
      console.log(`  Campo total_questions: ${test.total_questions}`)
      console.log(`  Campo total_correct: ${test.total_correct || 'NULL'}`)
      console.log(`  Preguntas guardadas reales: ${questions.length}`)
      console.log(`  Correctas reales: ${correct}`)
    })
  }

  // Tests de la última semana
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const { data: weekTests } = await supabase
    .from('tests')
    .select(`
      id,
      created_at,
      test_questions (
        is_correct
      )
    `)
    .eq('user_id', userId)
    .gte('created_at', weekAgo.toISOString())

  console.log('\n📊 TESTS ÚLTIMA SEMANA:')
  let totalWeekQuestions = 0
  let totalWeekCorrect = 0

  if (weekTests?.length > 0) {
    weekTests.forEach(test => {
      const questions = test.test_questions || []
      const correct = questions.filter(q => q.is_correct).length
      totalWeekQuestions += questions.length
      totalWeekCorrect += correct

      console.log(`  ${new Date(test.created_at).toLocaleDateString()}: ${questions.length} preguntas, ${correct} correctas`)
    })

    console.log(`\nTOTAL SEMANA: ${totalWeekQuestions} preguntas, ${totalWeekCorrect} correctas`)
    console.log(`PRECISIÓN SEMANAL: ${totalWeekQuestions > 0 ? Math.round(totalWeekCorrect/totalWeekQuestions * 100) : 0}%`)
  }
}

checkTodayTest().catch(console.error)