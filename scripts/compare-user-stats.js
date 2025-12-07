// Comparar estadísticas entre Manuel y Nila
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function compareUserStats() {
  const users = [
    { name: 'Manuel', id: '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f' },
    { name: 'Nila', id: 'c16c186a-4e70-4b1e-a3bd-c107e13670dd' }
  ]

  console.log('📊 COMPARACIÓN DE ESTADÍSTICAS\n')
  console.log('='.repeat(60))

  for (const user of users) {
    console.log(`\n👤 ${user.name} (${user.id})`)
    console.log('-'.repeat(40))

    // 1. Verificar si existe en auth.users (no podemos acceder directamente)
    // Usar la función RPC en su lugar
    const authUser = null // Auth.users no es accesible directamente


    // 2. Tests totales
    const { data: userTests } = await supabase
      .from('tests')
      .select('id, created_at')
      .eq('user_id', user.id)

    console.log(`\n📚 Tests totales: ${userTests?.length || 0}`)

    if (userTests?.length > 0) {
      const testIds = userTests.map(t => t.id)

      // 3. Preguntas totales
      const { count: totalQuestions } = await supabase
        .from('test_questions')
        .select('*', { count: 'exact', head: true })
        .in('test_id', testIds)

      console.log(`📝 Preguntas totales: ${totalQuestions || 0}`)

      // 4. Respuestas correctas
      const { count: correctAnswers } = await supabase
        .from('test_questions')
        .select('*', { count: 'exact', head: true })
        .in('test_id', testIds)
        .eq('is_correct', true)

      console.log(`✅ Respuestas correctas: ${correctAnswers || 0}`)

      // 5. Precisión
      const accuracy = totalQuestions > 0
        ? Math.round((correctAnswers / totalQuestions) * 100)
        : 0
      console.log(`🎯 Precisión: ${accuracy}%`)

      // 6. Preguntas esta semana
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      const { data: weekTests } = await supabase
        .from('tests')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', weekAgo.toISOString())

      if (weekTests?.length > 0) {
        const weekTestIds = weekTests.map(t => t.id)

        const { count: weeklyQuestions } = await supabase
          .from('test_questions')
          .select('*', { count: 'exact', head: true })
          .in('test_id', weekTestIds)

        console.log(`📅 Preguntas esta semana: ${weeklyQuestions || 0}`)
      } else {
        console.log(`📅 Preguntas esta semana: 0`)
      }

      // 7. Racha actual
      const { data: streakData } = await supabase
        .from('user_streaks')
        .select('current_streak')
        .eq('user_id', user.id)
        .maybeSingle()

      console.log(`🔥 Racha actual: ${streakData?.current_streak || 0}`)

      // 8. Último test
      const lastTest = userTests[0]
      if (lastTest) {
        console.log(`\n📆 Último test: ${new Date(lastTest.created_at).toLocaleDateString()}`)
      }
    } else {
      console.log('❌ No tiene tests')
    }

    // 9. Verificar user_profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id, target_oposicion')
      .eq('id', user.id)
      .maybeSingle()

    if (profile) {
      console.log(`\n👤 Perfil: ${profile.target_oposicion || 'Sin oposición'}`)
    } else {
      console.log(`\n❌ No tiene perfil en user_profiles`)
    }
  }

  console.log('\n' + '='.repeat(60))

  // Verificar la función RPC para ambos
  console.log('\n🔧 VERIFICANDO FUNCIÓN RPC:\n')

  for (const user of users) {
    console.log(`\n${user.name}:`)
    const { data: rpcData, error } = await supabase.rpc('get_user_public_stats', {
      p_user_id: user.id
    })

    if (error) {
      console.log(`❌ Error en RPC: ${error.message}`)
    } else if (rpcData?.[0]) {
      const stats = rpcData[0]
      console.log(`  Total preguntas: ${stats.total_questions}`)
      console.log(`  Precisión: ${stats.global_accuracy}%`)
      console.log(`  Racha: ${stats.current_streak}`)
      console.log(`  Esta semana: ${stats.accuracy_this_week || 'NULL'}`)
    } else {
      console.log(`❌ RPC no devuelve datos`)
    }
  }
}

compareUserStats().catch(console.error)