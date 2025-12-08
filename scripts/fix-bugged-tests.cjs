require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const applyFix = process.argv.includes('--apply')

  console.log('🔧 Corrigiendo tests afectados por el bug...\n')

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

  // Analizar cada test
  const testsToFix = []
  for (const test of inProgressTests) {
    const { data: questions, error: questionsError } = await supabase
      .from('test_questions')
      .select('question_order, is_correct, created_at')
      .eq('test_id', test.id)
      .order('question_order', { ascending: true })

    if (!questionsError && questions.length > 0) {
      const savedQuestions = questions.length
      const hasAllQuestions = savedQuestions >= (test.total_questions || 0)

      if (hasAllQuestions) {
        // Usar el created_at de la última pregunta como completed_at
        const lastQuestionTime = questions[questions.length - 1].created_at
        const correctAnswers = questions.filter(q => q.is_correct).length

        testsToFix.push({
          ...test,
          saved_questions: savedQuestions,
          correct_answers: correctAnswers,
          completed_at_to_set: lastQuestionTime
        })
      }
    }
  }

  console.log(`✅ Tests encontrados para corregir: ${testsToFix.length}\n`)

  if (testsToFix.length === 0) {
    console.log('No hay tests para corregir.')
    return
  }

  // Mostrar resumen
  console.log('📋 RESUMEN DE TESTS A CORREGIR:')
  testsToFix.forEach((test, i) => {
    console.log(`${i + 1}. ${test.id} - ${test.correct_answers}/${test.saved_questions} correctas`)
  })

  const byDate = {}
  testsToFix.forEach(test => {
    const date = new Date(test.created_at).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' })
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(test)
  })

  console.log('\n📅 POR FECHA:')
  Object.keys(byDate).sort().reverse().forEach(date => {
    console.log(`   ${date}: ${byDate[date].length} tests`)
  })

  if (!applyFix) {
    console.log('\n⚠️  MODO SIMULACIÓN - No se aplicarán cambios')
    console.log('Para aplicar los cambios, ejecuta:')
    console.log('   node scripts/fix-bugged-tests.cjs --apply\n')
    return
  }

  console.log('\n🔧 APLICANDO CORRECCIONES...\n')

  let fixed = 0
  let errors = 0

  for (const test of testsToFix) {
    try {
      const { error: updateError } = await supabase
        .from('tests')
        .update({
          is_completed: true,
          completed_at: test.completed_at_to_set
        })
        .eq('id', test.id)

      if (updateError) {
        console.error(`❌ Error en test ${test.id}:`, updateError.message)
        errors++
      } else {
        console.log(`✅ ${fixed + 1}/${testsToFix.length} - Test ${test.id} corregido`)
        fixed++
      }
    } catch (err) {
      console.error(`❌ Error en test ${test.id}:`, err.message)
      errors++
    }
  }

  console.log(`\n🎉 CORRECCIÓN COMPLETADA:`)
  console.log(`   ✅ Tests corregidos: ${fixed}`)
  console.log(`   ❌ Errores: ${errors}`)
}

main()
