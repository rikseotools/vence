// Debug script for Manuel's statistics
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugStats() {
  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f' // Manuel
  
  console.log('\n🔍 DEPURACIÓN COMPLETA DE ESTADÍSTICAS\n')
  console.log('='.repeat(60))

  // 1. Tests de los últimos 7 días con preguntas
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const { data: weekTests } = await supabase
    .from('tests')
    .select('id, created_at, total_questions, total_correct')
    .eq('user_id', userId)
    .gte('created_at', weekStart.toISOString())
    .order('created_at', { ascending: false })

  console.log('\n📊 TESTS ÚLTIMOS 7 DÍAS:')
  if (weekTests?.length > 0) {
    let totalQuestions = 0
    let totalCorrect = 0
    
    weekTests.forEach(test => {
      console.log(`   Test ${test.id}:`)
      console.log(`     - Fecha: ${test.created_at}`)
      console.log(`     - Preguntas: ${test.total_questions}`)
      console.log(`     - Correctas: ${test.total_correct || 'NULL'}`)
      
      if (test.total_questions) totalQuestions += test.total_questions
      if (test.total_correct) totalCorrect += test.total_correct
    })
    
    console.log(`\n   TOTAL SEMANA:`)
    console.log(`     - Preguntas: ${totalQuestions}`)
    console.log(`     - Correctas: ${totalCorrect}`)
    console.log(`     - Precisión: ${totalQuestions > 0 ? Math.round(totalCorrect/totalQuestions * 100) : 0}%`)
  }

  // 2. Test questions de los últimos 7 días
  const { data: weekQuestions, error: weekQError } = await supabase
    .from('test_questions')
    .select('id, is_correct, created_at, test_id')
    .eq('user_id', userId)
    .gte('created_at', weekStart.toISOString())

  console.log('\n📝 TEST_QUESTIONS ÚLTIMOS 7 DÍAS:')
  if (weekQError) {
    console.log('   ❌ Error:', weekQError.message)
  } else if (weekQuestions?.length > 0) {
    const correct = weekQuestions.filter(q => q.is_correct).length
    console.log(`   Total preguntas: ${weekQuestions.length}`)
    console.log(`   Correctas: ${correct}`)
    console.log(`   Precisión: ${Math.round(correct/weekQuestions.length * 100)}%`)
    
    // Agrupar por test_id
    const byTest = {}
    weekQuestions.forEach(q => {
      if (!byTest[q.test_id]) byTest[q.test_id] = { total: 0, correct: 0 }
      byTest[q.test_id].total++
      if (q.is_correct) byTest[q.test_id].correct++
    })
    
    console.log('\n   Por test_id:')
    Object.entries(byTest).forEach(([testId, stats]) => {
      console.log(`     ${testId}: ${stats.total} preguntas, ${stats.correct} correctas`)
    })
  } else {
    console.log('   No hay preguntas en los últimos 7 días')
  }

  // 3. Verificar mes pasado (30-60 días)
  const monthStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  const monthEnd = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  
  const { data: monthQuestions } = await supabase
    .from('test_questions')
    .select('id, is_correct')
    .eq('user_id', userId)
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', monthEnd.toISOString())

  console.log('\n📊 MES PASADO (30-60 días):')
  if (monthQuestions?.length > 0) {
    const correct = monthQuestions.filter(q => q.is_correct).length
    console.log(`   Total preguntas: ${monthQuestions.length}`)
    console.log(`   Correctas: ${correct}`)
    console.log(`   Precisión: ${Math.round(correct/monthQuestions.length * 100)}%`)
  } else {
    console.log('   No hay datos del mes pasado')
  }

  // 4. Verificar hace 3 meses (90-120 días)
  const threeMonthStart = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000)
  const threeMonthEnd = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  
  const { data: threeMonthQuestions } = await supabase
    .from('test_questions')
    .select('id, is_correct')
    .eq('user_id', userId)
    .gte('created_at', threeMonthStart.toISOString())
    .lt('created_at', threeMonthEnd.toISOString())

  console.log('\n📊 HACE 3 MESES (90-120 días):')
  if (threeMonthQuestions?.length > 0) {
    const correct = threeMonthQuestions.filter(q => q.is_correct).length
    console.log(`   Total preguntas: ${threeMonthQuestions.length}`)
    console.log(`   Correctas: ${correct}`)
    console.log(`   Precisión: ${Math.round(correct/threeMonthQuestions.length * 100)}%`)
  } else {
    console.log('   No hay datos de hace 3 meses')
  }

  // 5. Verificar temas estudiados
  const { data: allTopics } = await supabase
    .from('test_questions')
    .select('tema_number')
    .eq('user_id', userId)
    .not('tema_number', 'is', null)

  if (allTopics?.length > 0) {
    const uniqueTopics = [...new Set(allTopics.map(t => t.tema_number))]
    console.log('\n📚 TEMAS ESTUDIADOS:')
    console.log(`   Total temas únicos: ${uniqueTopics.size}`)
    
    // Verificar temas dominados
    let masteredCount = 0
    for (const tema of uniqueTopics) {
      const { data: temaQuestions } = await supabase
        .from('test_questions')
        .select('is_correct')
        .eq('user_id', userId)
        .eq('tema_number', tema)
      
      if (temaQuestions?.length >= 10) {
        const correct = temaQuestions.filter(q => q.is_correct).length
        const accuracy = correct / temaQuestions.length
        if (accuracy > 0.8) {
          masteredCount++
        }
      }
    }
    console.log(`   Temas dominados (>80% con 10+ preguntas): ${masteredCount}`)
  }

  console.log('\n' + '='.repeat(60))
}

debugStats().catch(console.error)
