require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Investigando tests "en progreso"...\n')

  // Obtener tests sin completed_at en los últimos 2 días
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const { data: inProgressTests, error } = await supabase
    .from('tests')
    .select('id, user_id, created_at, completed_at, is_completed, total_questions, score')
    .gte('created_at', twoDaysAgo.toISOString())
    .is('completed_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`📊 Tests sin completed_at: ${inProgressTests.length}\n`)

  // Analizar cada test
  const testsAnalysis = []
  for (const test of inProgressTests) {
    const { data: questions, error: questionsError } = await supabase
      .from('test_questions')
      .select('question_order, is_correct')
      .eq('test_id', test.id)
      .order('question_order', { ascending: true })

    if (!questionsError) {
      const savedQuestions = questions.length
      const hasAllQuestions = savedQuestions >= (test.total_questions || 0)
      const maxOrder = questions.length > 0 ? Math.max(...questions.map(q => q.question_order)) : 0
      const correctAnswers = questions.filter(q => q.is_correct).length

      testsAnalysis.push({
        ...test,
        saved_questions: savedQuestions,
        max_order: maxOrder,
        correct_answers: correctAnswers,
        has_all_questions: hasAllQuestions,
        should_be_completed: hasAllQuestions,
        age_hours: Math.round((Date.now() - new Date(test.created_at).getTime()) / (1000 * 60 * 60))
      })
    }
  }

  // Clasificar
  const actuallyCompleted = testsAnalysis.filter(t => t.should_be_completed)
  const partiallyDone = testsAnalysis.filter(t => !t.should_be_completed && t.saved_questions > 0)
  const notStarted = testsAnalysis.filter(t => t.saved_questions === 0)

  console.log('📋 CLASIFICACIÓN:')
  console.log(`   🐛 Tests COMPLETOS pero sin marcar (BUG): ${actuallyCompleted.length}`)
  console.log(`   ⏸️  Tests parcialmente hechos (abandonados): ${partiallyDone.length}`)
  console.log(`   🆕 Tests creados pero sin empezar: ${notStarted.length}\n`)

  if (actuallyCompleted.length > 0) {
    console.log('🐛 TESTS COMPLETOS PERO NO MARCADOS (ESTOS SON EL BUG):')
    actuallyCompleted.forEach((test, i) => {
      const createdDate = new Date(test.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
      console.log(`\n${i + 1}. Test ID: ${test.id}`)
      console.log(`   Usuario: ${test.user_id}`)
      console.log(`   Creado: ${createdDate}`)
      console.log(`   Preguntas: ${test.saved_questions}/${test.total_questions} ✅ (TODAS guardadas)`)
      console.log(`   Respuestas correctas: ${test.correct_answers}`)
      console.log(`   Score en BD: ${test.score}`)
      console.log(`   completed_at: NULL ❌`)
      console.log(`   is_completed: ${test.is_completed} ❌`)
      console.log(`   Antigüedad: ${test.age_hours} horas`)
    })

    // Agrupar por fecha
    const byDate = {}
    actuallyCompleted.forEach(test => {
      const date = new Date(test.created_at).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })
      if (!byDate[date]) byDate[date] = []
      byDate[date].push(test)
    })

    console.log('\n📅 TESTS AFECTADOS POR FECHA:')
    Object.keys(byDate).sort().reverse().forEach(date => {
      const tests = byDate[date]
      const uniqueUsers = new Set(tests.map(t => t.user_id)).size
      console.log(`   ${date}: ${tests.length} tests de ${uniqueUsers} usuarios`)
    })

    console.log('\n💡 ESTOS TESTS TIENEN EL BUG - Necesitan ser corregidos!')
  }

  if (partiallyDone.length > 0) {
    console.log(`\n⏸️  TESTS PARCIALMENTE HECHOS (primeros 10):`)
    partiallyDone.slice(0, 10).forEach((test, i) => {
      console.log(`${i + 1}. ${test.saved_questions}/${test.total_questions} preguntas - ${test.age_hours}h - User: ${test.user_id.substring(0, 8)}...`)
    })
  }

  if (notStarted.length > 0) {
    console.log(`\n🆕 TESTS NO INICIADOS: ${notStarted.length} tests creados pero sin responder ninguna pregunta`)
  }
}

main()
