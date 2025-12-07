// Test de estadísticas de usuario
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testUserStats() {
  // Tu usuario (Manuel)
  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'

  console.log('\n🔍 PROBANDO ESTADÍSTICAS DE MANUEL\n')
  console.log('='.repeat(60))

  // 1. Probar función RPC actual
  const { data: rpcStats, error: rpcError } = await supabase.rpc('get_user_public_stats', {
    p_user_id: userId
  })

  console.log('\n📊 RPC get_user_public_stats:')
  if (rpcError) {
    console.error('❌ Error:', rpcError)
  } else if (rpcStats?.[0]) {
    const stats = rpcStats[0]
    console.log('✅ Datos recibidos:')
    console.log('   Total preguntas:', stats.total_questions)
    console.log('   Precisión global:', stats.global_accuracy + '%')
    console.log('   Racha actual:', stats.current_streak)
    console.log('   Temas dominados:', stats.mastered_topics)
    console.log('   --- EVOLUCIÓN ---')
    console.log('   Esta semana:', stats.accuracy_this_week || 'NULL')
    console.log('   Mes pasado:', stats.accuracy_last_month || 'NULL')
    console.log('   Hace 3 meses:', stats.accuracy_three_months_ago || 'NULL')
  }

  // 2. Verificar tests recientes directamente
  const { data: recentTests } = await supabase
    .from('tests')
    .select('id, created_at, total_questions')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('\n📚 Tests últimos 7 días:')
  if (recentTests?.length > 0) {
    console.log(`   Total tests: ${recentTests.length}`)
    recentTests.forEach(test => {
      console.log(`   - ${test.created_at}: ${test.total_questions} preguntas`)
    })
  } else {
    console.log('   No hay tests en los últimos 7 días')
  }

  // 3. Verificar test_questions directamente
  const { data: weekQuestions } = await supabase
    .from('test_questions')
    .select('id, is_correct, created_at')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

  if (weekQuestions?.length > 0) {
    const correct = weekQuestions.filter(q => q.is_correct).length
    const accuracy = Math.round((correct / weekQuestions.length) * 100 * 10) / 10
    console.log('\n📊 Cálculo manual semana:')
    console.log(`   Total preguntas: ${weekQuestions.length}`)
    console.log(`   Correctas: ${correct}`)
    console.log(`   Precisión: ${accuracy}%`)
  }

  // 4. Verificar user_learning_analytics
  const { data: analytics } = await supabase
    .from('user_learning_analytics')
    .select('*')
    .eq('user_id', userId)
    .limit(1)

  console.log('\n🎯 User Learning Analytics:')
  if (analytics?.[0]) {
    console.log('   Total preguntas:', analytics[0].total_questions_answered)
    console.log('   Precisión global:', analytics[0].overall_accuracy)
    console.log('   Tests completados:', analytics[0].total_tests_completed)
  } else {
    console.log('   No hay datos de analytics')
  }

  // 5. Verificar temas con progreso
  const { data: topicProgress } = await supabase
    .from('test_questions')
    .select('tema_number')
    .eq('user_id', userId)
    .not('tema_number', 'is', null)

  if (topicProgress?.length > 0) {
    const uniqueTopics = new Set(topicProgress.map(t => t.tema_number))
    console.log('\n📚 Temas estudiados:')
    console.log(`   Total temas únicos: ${uniqueTopics.size}`)

    // Calcular temas dominados manualmente
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
          console.log(`   ✅ Tema ${tema}: ${Math.round(accuracy * 100)}% (${temaQuestions.length} preguntas)`)
        }
      }
    }
    console.log(`   Total temas dominados (>80% con 10+ preguntas): ${masteredCount}`)
  }

  console.log('\n' + '='.repeat(60))
}

testUserStats().catch(console.error)