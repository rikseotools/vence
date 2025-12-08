require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Verificando tests de los últimos 2 días...\n')

  // Obtener todos los tests creados en los últimos 2 días
  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

  const { data: recentTests, error } = await supabase
    .from('tests')
    .select('id, user_id, created_at, completed_at, is_completed, total_questions')
    .gte('created_at', twoDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`📊 Tests creados en últimos 2 días: ${recentTests.length}\n`)

  // Analizar cada test
  const testsWithAnalysis = []
  for (const test of recentTests) {
    const { count, error: countError } = await supabase
      .from('test_questions')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', test.id)

    if (!countError) {
      const hasAllQuestions = count >= (test.total_questions || 0)
      const shouldBeCompleted = test.completed_at && hasAllQuestions
      const isWrong = shouldBeCompleted && !test.is_completed

      testsWithAnalysis.push({
        ...test,
        saved_questions: count,
        has_all_questions: hasAllQuestions,
        should_be_completed: shouldBeCompleted,
        is_wrong: isWrong
      })
    }
  }

  // Tests completados correctamente
  const completedCorrectly = testsWithAnalysis.filter(t => t.is_completed && t.has_all_questions)

  // Tests que deberían estar completados pero no lo están (BUG)
  const buggedTests = testsWithAnalysis.filter(t => t.is_wrong)

  // Tests en progreso
  const inProgress = testsWithAnalysis.filter(t => !t.completed_at)

  // Tests realmente incompletos (completados pero sin todas las preguntas)
  const incomplete = testsWithAnalysis.filter(t => t.completed_at && !t.has_all_questions)

  console.log('📋 RESUMEN:')
  console.log(`   ✅ Tests completados correctamente: ${completedCorrectly.length}`)
  console.log(`   ❌ Tests con BUG (deberían estar completados): ${buggedTests.length}`)
  console.log(`   🔄 Tests en progreso: ${inProgress.length}`)
  console.log(`   ⚠️  Tests incompletos (perdieron preguntas): ${incomplete.length}\n`)

  if (buggedTests.length > 0) {
    console.log('🐛 TESTS AFECTADOS POR EL BUG:')
    buggedTests.forEach((test, i) => {
      const createdDate = new Date(test.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
      const completedDate = new Date(test.completed_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
      console.log(`\n${i + 1}. Test ID: ${test.id}`)
      console.log(`   Usuario: ${test.user_id}`)
      console.log(`   Creado: ${createdDate}`)
      console.log(`   Completado: ${completedDate}`)
      console.log(`   Preguntas guardadas: ${test.saved_questions}/${test.total_questions}`)
      console.log(`   is_completed: ${test.is_completed} ❌ (debería ser true)`)
    })

    // Agrupar por fecha
    const byDate = {}
    buggedTests.forEach(test => {
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

    console.log('\n💡 Para corregir estos tests, ejecuta:')
    console.log('   node scripts/fix-recent-incomplete-tests.cjs --apply\n')
  } else {
    console.log('✨ ¡Perfecto! No hay tests afectados por el bug.')
  }

  if (completedCorrectly.length > 0) {
    console.log('\n✅ TESTS COMPLETADOS CORRECTAMENTE (últimos 5):')
    completedCorrectly.slice(0, 5).forEach((test, i) => {
      const completedDate = new Date(test.completed_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
      console.log(`${i + 1}. ${completedDate} - ${test.saved_questions} preguntas - User: ${test.user_id.substring(0, 8)}...`)
    })
  }
}

main()
