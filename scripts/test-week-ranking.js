import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function testWeekRanking() {
  console.log('🔍 SIMULANDO COMPORTAMIENTO DEL COMPONENTE RankingModal\n')
  console.log('='.repeat(60))

  // Simular exactamente lo que hace el componente
  const now = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)
  sevenDaysAgo.setUTCHours(0, 0, 0, 0)
  const startDate = sevenDaysAgo.toISOString()

  console.log('📅 Configuración:')
  console.log(`   StartDate: ${startDate}`)
  console.log(`   EndDate: null`)
  console.log(`   Min questions: 5`)
  console.log('')

  // 1. Llamar RPC como lo hace el componente
  console.log('1️⃣ LLAMANDO RPC get_ranking_for_period:')
  const { data: rankingData, error } = await supabase.rpc('get_ranking_for_period', {
    p_start_date: startDate,
    p_end_date: null,
    p_min_questions: 5,
    p_limit: 100
  })

  if (error) {
    console.error('   ❌ Error:', error)
    return
  }

  console.log(`   ✅ Usuarios devueltos: ${rankingData?.length || 0}`)

  if (!rankingData || rankingData.length === 0) {
    console.log('   No hay datos de ranking')
    return
  }

  // 2. Obtener nombres como lo hace el componente
  const userIds = rankingData.map(u => u.user_id)
  console.log(`\n2️⃣ OBTENIENDO NOMBRES PARA ${userIds.length} USUARIOS:`)

  // Obtener de admin_users_with_roles
  const { data: adminProfiles, error: adminError } = await supabase
    .from('admin_users_with_roles')
    .select('user_id, full_name, email')
    .in('user_id', userIds)

  if (adminError) {
    console.log('   ❌ Error obteniendo admin profiles:', adminError)
  } else {
    console.log(`   ✅ Admin profiles obtenidos: ${adminProfiles?.length || 0}`)
  }

  // Obtener de public_user_profiles
  const { data: publicProfiles, error: publicError } = await supabase
    .from('public_user_profiles')
    .select('id, display_name, ciudad')
    .in('id', userIds)

  if (publicError) {
    console.log('   ❌ Error obteniendo public profiles:', publicError)
  } else {
    console.log(`   ✅ Public profiles obtenidos: ${publicProfiles?.length || 0}`)
  }

  // 3. Construir ranking final como lo hace el componente
  console.log('\n3️⃣ CONSTRUYENDO RANKING FINAL:')

  const getDisplayName = (userId) => {
    const customProfile = publicProfiles?.find(p => p.id === userId)
    if (customProfile?.display_name) {
      return customProfile.display_name
    }

    const adminProfile = adminProfiles?.find(p => p.user_id === userId)
    if (adminProfile?.full_name) {
      const firstName = adminProfile.full_name.split(' ')[0]
      if (firstName?.trim()) return firstName.trim()
    }

    if (adminProfile?.email) {
      return adminProfile.email.split('@')[0]
    }

    return 'Usuario anónimo'
  }

  const finalRanking = rankingData.map((stats, index) => {
    return {
      userId: stats.user_id,
      totalQuestions: Number(stats.total_questions),
      correctAnswers: Number(stats.correct_answers),
      accuracy: Number(stats.accuracy),
      rank: index + 1,
      name: getDisplayName(stats.user_id)
    }
  })

  console.log(`   Total usuarios en ranking final: ${finalRanking.length}`)
  console.log('\n   Top 10 usuarios:')
  finalRanking.slice(0, 10).forEach(user => {
    console.log(`   ${user.rank}. ${user.name} - ${user.totalQuestions} preguntas, ${user.accuracy}% precisión`)
  })

  // 4. Verificar si hay usuarios sin nombre
  const usersWithoutName = finalRanking.filter(u => u.name === 'Usuario anónimo')
  if (usersWithoutName.length > 0) {
    console.log(`\n   ⚠️ ${usersWithoutName.length} usuarios sin nombre detectado`)
    console.log('   Esto podría causar problemas en la visualización')
  }

  console.log('\n' + '='.repeat(60))
  console.log('✅ RESUMEN:')
  console.log(`   RPC devuelve: ${rankingData.length} usuarios`)
  console.log(`   Admin profiles encontrados: ${adminProfiles?.length || 0}`)
  console.log(`   Public profiles encontrados: ${publicProfiles?.length || 0}`)
  console.log(`   Ranking final: ${finalRanking.length} usuarios`)
  console.log(`   Usuarios sin nombre: ${usersWithoutName.length}`)
}

testWeekRanking().catch(console.error)