// Verify schema and fix stats queries
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verifySchema() {
  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f' // Manuel

  console.log('\n🔍 VERIFICACIÓN DE ESQUEMA Y ESTADÍSTICAS\n')
  console.log('='.repeat(60))

  // 2. Get test_questions through tests table (correct join)
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const { data: weekTests } = await supabase
    .from('tests')
    .select(`
      id,
      created_at,
      total_questions,
      total_correct,
      test_questions (
        id,
        is_correct,
        created_at,
        tema_number
      )
    `)
    .eq('user_id', userId)
    .gte('created_at', weekStart.toISOString())
    .order('created_at', { ascending: false })

  console.log('\n📊 TESTS CON PREGUNTAS (ÚLTIMOS 7 DÍAS):')
  if (weekTests?.length > 0) {
    let totalQuestions = 0
    let totalCorrect = 0

    weekTests.forEach(test => {
      const questions = test.test_questions || []
      const correct = questions.filter(q => q.is_correct).length
      const testIdShort = test.id.substring(0, 8)

      console.log(`\n   Test ${testIdShort}:`)
      console.log(`     - Fecha: ${new Date(test.created_at).toLocaleDateString()}`)
      console.log(`     - Preguntas guardadas: ${questions.length}`)
      console.log(`     - Correctas: ${correct}`)
      console.log(`     - total_questions campo: ${test.total_questions}`)
      console.log(`     - total_correct campo: ${test.total_correct || 'NULL'}`)

      totalQuestions += questions.length
      totalCorrect += correct
    })

    console.log(`\n   📈 TOTALES REALES SEMANA:`)
    console.log(`     - Preguntas: ${totalQuestions}`)
    console.log(`     - Correctas: ${totalCorrect}`)
    console.log(`     - Precisión: ${totalQuestions > 0 ? Math.round(totalCorrect/totalQuestions * 100) : 0}%`)
  } else {
    console.log('   No hay tests en los últimos 7 días')
  }

  // 3. Check data for past periods
  const monthStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  const monthEnd = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const { data: monthTests } = await supabase
    .from('tests')
    .select(`
      test_questions (
        is_correct
      )
    `)
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', monthEnd.toISOString())

  console.log('\n📊 MES PASADO (30-60 días):')
  if (monthTests?.length > 0) {
    const allQuestions = monthTests.flatMap(t => t.test_questions || [])
    if (allQuestions.length > 0) {
      const correct = allQuestions.filter(q => q.is_correct).length
      console.log(`   Total preguntas: ${allQuestions.length}`)
      console.log(`   Correctas: ${correct}`)
      console.log(`   Precisión: ${Math.round(correct/allQuestions.length * 100)}%`)
    } else {
      console.log('   Tests encontrados pero sin preguntas')
    }
  } else {
    console.log('   No hay tests del mes pasado')
  }

  // 4. Check 3 months ago
  const threeMonthStart = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
  const threeMonthEnd = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const { data: threeMonthTests } = await supabase
    .from('tests')
    .select(`
      test_questions (
        is_correct
      )
    `)
    .eq('user_id', userId)
    .gte('created_at', threeMonthStart.toISOString())
    .lt('created_at', threeMonthEnd.toISOString())

  console.log('\n📊 HACE 3 MESES (90-120 días):')
  if (threeMonthTests?.length > 0) {
    const allQuestions = threeMonthTests.flatMap(t => t.test_questions || [])
    if (allQuestions.length > 0) {
      const correct = allQuestions.filter(q => q.is_correct).length
      console.log(`   Total preguntas: ${allQuestions.length}`)
      console.log(`   Correctas: ${correct}`)
      console.log(`   Precisión: ${Math.round(correct/allQuestions.length * 100)}%`)
    } else {
      console.log('   Tests encontrados pero sin preguntas')
    }
  } else {
    console.log('   No hay tests de hace 3 meses')
  }

  // 5. Check topics studied
  const { data: allTests } = await supabase
    .from('tests')
    .select(`
      test_questions (
        tema_number,
        is_correct
      )
    `)
    .eq('user_id', userId)

  if (allTests?.length > 0) {
    const allQuestions = allTests.flatMap(t => t.test_questions || [])
    const topicsMap = {}

    allQuestions.forEach(q => {
      if (q.tema_number) {
        if (!topicsMap[q.tema_number]) {
          topicsMap[q.tema_number] = { total: 0, correct: 0 }
        }
        topicsMap[q.tema_number].total++
        if (q.is_correct) topicsMap[q.tema_number].correct++
      }
    })

    console.log('\n📚 TEMAS ESTUDIADOS:')
    console.log(`   Total temas únicos: ${Object.keys(topicsMap).length}`)

    const mastered = Object.entries(topicsMap).filter(([_, stats]) => {
      return stats.total >= 10 && (stats.correct / stats.total) > 0.8
    })

    console.log(`   Temas dominados (>80% con 10+ preguntas): ${mastered.length}`)

    // Show which themes have been studied
    console.log('\n   Desglose por tema:')
    Object.entries(topicsMap).forEach(([tema, stats]) => {
      const accuracy = Math.round((stats.correct / stats.total) * 100)
      const status = stats.total >= 10 && accuracy > 80 ? '✅' : '📖'
      console.log(`     ${status} Tema ${tema}: ${stats.total} preguntas, ${accuracy}% precisión`)
    })
  }

  console.log('\n' + '='.repeat(60))
}

verifySchema().catch(console.error)