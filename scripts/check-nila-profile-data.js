// Verificar datos de perfil de Nila
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkNilaProfile() {
  const userId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'

  console.log('\n🔍 DATOS DE PERFIL DE NILA\n')
  console.log('='.repeat(60))

  // 1. user_profiles
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  console.log('\n📋 USER_PROFILES:')
  console.log('   target_oposicion:', profile?.target_oposicion || 'NO CONFIGURADA')
  console.log('   nickname:', profile?.nickname)
  console.log('   full_name:', profile?.full_name)
  console.log('   ciudad:', profile?.ciudad)

  // 2. user_streaks
  const { data: streak } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', userId)
    .single()

  console.log('\n🔥 USER_STREAKS:')
  if (streak) {
    console.log('   current_streak:', streak.current_streak)
    console.log('   longest_streak:', streak.longest_streak)
    console.log('   last_activity_date:', streak.last_activity_date)
  } else {
    console.log('   NO EXISTE REGISTRO DE RACHA')
  }

  // 3. Tests de hoy
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data: todayTests } = await supabase
    .from('tests')
    .select('id, title, total_questions, score, created_at')
    .eq('user_id', userId)
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString())

  console.log('\n📚 TESTS DE HOY:')
  console.log('   Total tests:', todayTests?.length || 0)
  if (todayTests?.length > 0) {
    todayTests.forEach(test => {
      console.log(`   - ${test.title}: ${test.total_questions} preguntas (${test.score}% acierto)`)
    })
  }

  // 4. Ejecutar RPC get_user_public_stats
  const { data: stats, error: statsError } = await supabase.rpc('get_user_public_stats', {
    p_user_id: userId
  })

  console.log('\n📊 RPC get_user_public_stats:')
  if (statsError) {
    console.log('   ERROR:', statsError.message)
  } else if (stats?.[0]) {
    console.log('   total_questions:', stats[0].total_questions)
    console.log('   correct_answers:', stats[0].correct_answers)
    console.log('   global_accuracy:', stats[0].global_accuracy + '%')
    console.log('   last_activity_date:', stats[0].last_activity_date)
  }

  console.log('\n' + '='.repeat(60))
}

checkNilaProfile().catch(console.error)