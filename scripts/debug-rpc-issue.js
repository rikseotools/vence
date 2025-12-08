import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugRPCIssue() {
  console.log('🔍 DEBUGGING RPC ISSUE\n')
  console.log('='.repeat(60))

  const manuelId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'

  // 1. Probar la RPC
  console.log('1️⃣ Probando RPC get_user_public_stats:')
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_user_public_stats', {
    p_user_id: manuelId
  })

  if (rpcError) {
    console.log('❌ Error en RPC:', rpcError)
  } else if (rpcData && rpcData.length > 0) {
    console.log('✅ RPC devuelve datos:')
    const stats = rpcData[0]
    console.log(`   - total_questions: ${stats.total_questions}`)
    console.log(`   - correct_answers: ${stats.correct_answers}`)
    console.log(`   - global_accuracy: ${stats.global_accuracy}`)
    console.log(`   - current_streak: ${stats.current_streak}`)
    console.log(`   - today_questions: ${stats.today_questions}`)
    console.log(`   - questions_this_week: ${stats.questions_this_week}`)
  } else {
    console.log('⚠️ RPC devuelve array vacío')
  }

  // 2. Verificar tablas directamente
  console.log('\n2️⃣ Verificando tablas directamente:')

  // Tests totales
  const { count: totalTests } = await supabase
    .from('tests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', manuelId)
    .eq('is_completed', true)

  console.log(`   Tests completados: ${totalTests}`)

  // Preguntas totales
  const { data: testsWithQuestions } = await supabase
    .from('tests')
    .select('id')
    .eq('user_id', manuelId)
    .eq('is_completed', true)

  if (testsWithQuestions && testsWithQuestions.length > 0) {
    const testIds = testsWithQuestions.map(t => t.id)
    const { count: totalQuestions } = await supabase
      .from('test_questions')
      .select('*', { count: 'exact', head: true })
      .in('test_id', testIds)

    console.log(`   Preguntas totales: ${totalQuestions}`)
  }

  // 3. Verificar user_streak_stats
  console.log('\n3️⃣ Verificando user_streak_stats:')
  const { data: streakData, error: streakError } = await supabase
    .from('user_streak_stats')
    .select('current_streak, longest_streak')
    .eq('user_id', manuelId)
    .single()

  if (streakError) {
    console.log('❌ Error o no existe en user_streak_stats:', streakError.message)
  } else if (streakData) {
    console.log(`   current_streak: ${streakData.current_streak}`)
    console.log(`   longest_streak: ${streakData.longest_streak}`)
  }

  // 4. Verificar user_profiles
  console.log('\n4️⃣ Verificando user_profiles:')
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('target_oposicion')
    .eq('user_id', manuelId)
    .single()

  if (profileData) {
    console.log(`   target_oposicion: ${profileData.target_oposicion}`)
  } else {
    console.log('   ⚠️ No existe perfil en user_profiles')
  }

  // 5. Verificar auth.users
  console.log('\n5️⃣ Verificando auth.users:')
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const manuel = users.find(u => u.id === manuelId)
  if (manuel) {
    console.log(`   Usuario existe: ${manuel.email}`)
    console.log(`   Creado: ${new Date(manuel.created_at).toLocaleDateString('es-ES')}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n💡 POSIBLES CAUSAS:')
  console.log('1. La tabla user_streak_stats podría estar vacía')
  console.log('2. Los LEFT JOIN con "ON true" podrían estar fallando')
  console.log('3. Podría haber un problema con los CTE (WITH clauses)')
}

debugRPCIssue().catch(console.error)