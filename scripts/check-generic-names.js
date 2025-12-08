import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkGenericNames() {
  console.log('🔍 VERIFICANDO USUARIOS CON NOMBRES GENÉRICOS\n')
  console.log('='.repeat(60))

  // Obtener usuarios que han jugado en la última semana
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const { data: rankingData } = await supabase.rpc('get_ranking_for_period', {
    p_start_date: sevenDaysAgo.toISOString(),
    p_end_date: null,
    p_min_questions: 5,
    p_limit: 100
  })

  if (!rankingData || rankingData.length === 0) {
    console.log('No hay usuarios en el ranking')
    return
  }

  const userIds = rankingData.map(r => r.user_id)

  // Obtener perfiles de admin_users_with_roles
  const { data: adminProfiles } = await supabase
    .from('admin_users_with_roles')
    .select('user_id, full_name, email')
    .in('user_id', userIds)

  // Obtener perfiles públicos
  const { data: publicProfiles } = await supabase
    .from('public_user_profiles')
    .select('id, display_name')
    .in('id', userIds)

  console.log(`📊 Total usuarios en ranking: ${rankingData.length}`)
  console.log('')

  // Analizar nombres
  let genericCount = 0
  let withDisplayName = 0
  let withProperName = 0
  let problemUsers = []

  rankingData.forEach(user => {
    const adminProfile = adminProfiles?.find(p => p.user_id === user.user_id)
    const publicProfile = publicProfiles?.find(p => p.id === user.user_id)

    if (publicProfile?.display_name) {
      withDisplayName++
      return
    }

    if (!adminProfile) {
      problemUsers.push({
        userId: user.user_id,
        issue: 'No tiene perfil admin'
      })
      return
    }

    if (!adminProfile.full_name || adminProfile.full_name === 'Usuario' || adminProfile.full_name.trim() === '') {
      genericCount++
      problemUsers.push({
        userId: user.user_id,
        full_name: adminProfile.full_name || '(vacío)',
        email: adminProfile.email,
        issue: 'Nombre genérico o vacío'
      })
    } else {
      withProperName++
    }
  })

  console.log('📈 RESUMEN:')
  console.log(`   ✅ Con display_name personalizado: ${withDisplayName}`)
  console.log(`   ✅ Con nombre real en full_name: ${withProperName}`)
  console.log(`   ⚠️  Con nombre genérico: ${genericCount}`)
  console.log('')

  if (problemUsers.length > 0) {
    console.log('❌ USUARIOS PROBLEMÁTICOS:')
    problemUsers.forEach((user, i) => {
      console.log(`\n${i + 1}. Usuario ${user.userId.substring(0, 8)}...`)
      console.log(`   Problema: ${user.issue}`)
      if (user.full_name !== undefined) {
        console.log(`   full_name: "${user.full_name}"`)
      }
      if (user.email) {
        console.log(`   email: ${user.email}`)
        const emailName = user.email.split('@')[0]
        const cleanName = emailName.replace(/[0-9]+/g, '').replace(/[._-]/g, ' ').trim()
        if (cleanName) {
          console.log(`   Nombre limpio del email: "${cleanName.charAt(0).toUpperCase() + cleanName.slice(1)}"`)
        }
      }
    })

    console.log('\n💡 SOLUCIÓN APLICADA:')
    console.log('   Los usuarios con nombre genérico ahora mostrarán:')
    console.log('   1. Su display_name si lo tienen')
    console.log('   2. O el nombre extraído de su email (limpio y capitalizado)')
    console.log('   3. O "Anónimo" como último recurso')
  } else {
    console.log('✅ Todos los usuarios tienen nombres apropiados')
  }
}

checkGenericNames().catch(console.error)