import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkCarmenStats() {
  console.log('🔍 VERIFICANDO ESTADÍSTICAS DE CARMEN\n')
  console.log('='.repeat(60))

  // Buscar el ID de Carmen
  const { data: profiles } = await supabase
    .from('public_user_profiles')
    .select('id, display_name')
    .or('display_name.eq.CARMEN,display_name.eq.Carmen')

  console.log('Perfiles encontrados:', profiles)

  // También buscar por email
  const { data: adminProfiles } = await supabase
    .from('admin_users_with_roles')
    .select('user_id, full_name, email')
    .ilike('full_name', '%CARMEN%')

  console.log('\nPerfiles admin encontrados:', adminProfiles)

  if (adminProfiles && adminProfiles.length > 0) {
    const carmenId = adminProfiles[0].user_id
    console.log(`\n📊 Verificando stats para Carmen (${carmenId}):\n`)

    // 1. Llamar a la RPC como lo hace el componente
    const { data: stats, error } = await supabase.rpc('get_user_public_stats', {
      p_user_id: carmenId
    })

    if (error) {
      console.error('Error en RPC:', error)
      return
    }

    if (stats && stats[0]) {
      console.log('RPC devuelve:')
      console.log('  - today_tests:', stats[0].today_tests)
      console.log('  - today_questions:', stats[0].today_questions)
      console.log('  - today_correct:', stats[0].today_correct)
      console.log('  - total_questions:', stats[0].total_questions)
      console.log('  - current_streak:', stats[0].current_streak)
    }

    // 2. Verificar directamente en la base de datos
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: todayTests } = await supabase
      .from('tests')
      .select('id, created_at')
      .eq('user_id', carmenId)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())

    console.log(`\nTests de hoy: ${todayTests?.length || 0}`)

    if (todayTests && todayTests.length > 0) {
      const testIds = todayTests.map(t => t.id)

      const { data: questions } = await supabase
        .from('test_questions')
        .select('id, is_correct')
        .in('test_id', testIds)

      const totalQuestions = questions?.length || 0
      const correctQuestions = questions?.filter(q => q.is_correct).length || 0

      console.log(`Preguntas de hoy (verificación directa):`)
      console.log(`  - Total: ${totalQuestions}`)
      console.log(`  - Correctas: ${correctQuestions}`)
      console.log(`  - Precisión: ${totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0}%`)
    }

    // 3. Verificar si hay discrepancia
    if (stats?.[0]) {
      const rpcQuestions = stats[0].today_questions
      const { count: realQuestions } = await supabase
        .from('test_questions')
        .select('*', { count: 'exact', head: true })
        .in('test_id', todayTests?.map(t => t.id) || [])

      console.log('\n⚠️ ANÁLISIS DE DISCREPANCIA:')
      console.log(`  RPC dice: ${rpcQuestions} preguntas`)
      console.log(`  BD real: ${realQuestions} preguntas`)

      if (rpcQuestions !== realQuestions) {
        console.log('  ❌ HAY UNA DISCREPANCIA!')
        console.log('  La RPC no está calculando correctamente las preguntas de hoy')
      }
    }
  }
}

checkCarmenStats().catch(console.error)