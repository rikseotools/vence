// Test de la función RPC get_user_public_stats
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testRPC() {
  const userId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd' // Nila

  console.log('\n🔍 PROBANDO RPC get_user_public_stats\n')
  console.log('='.repeat(60))

  // Probar la función RPC
  const { data, error } = await supabase.rpc('get_user_public_stats', {
    p_user_id: userId
  })

  console.log('\n📊 RESULTADO:')
  if (error) {
    console.error('❌ ERROR:', error)
  } else {
    console.log('✅ DATA:', JSON.stringify(data, null, 2))

    if (data && data.length > 0) {
      const stats = data[0]
      console.log('\n📈 ESTADÍSTICAS DESGLOSADAS:')
      console.log('   user_id:', stats.user_id)
      console.log('   total_questions:', stats.total_questions)
      console.log('   correct_answers:', stats.correct_answers)
      console.log('   global_accuracy:', stats.global_accuracy)
      console.log('   total_tests:', stats.total_tests)
      console.log('   target_oposicion:', stats.target_oposicion)
      console.log('   current_streak:', stats.current_streak)
      console.log('   longest_streak:', stats.longest_streak)
      console.log('   today_tests:', stats.today_tests)
      console.log('   today_questions:', stats.today_questions)
      console.log('   today_correct:', stats.today_correct)
      console.log('   mastered_topics:', stats.mastered_topics)
      console.log('   last_activity_date:', stats.last_activity_date)
    } else {
      console.log('⚠️ No data returned or empty array')
    }
  }

  console.log('\n' + '='.repeat(60))
}

testRPC().catch(console.error)