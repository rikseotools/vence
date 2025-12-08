import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkStreaks() {
  console.log('🔍 VERIFICANDO RACHAS DE 60+ DÍAS\n')
  console.log('='.repeat(60))

  // 1. Verificar usuarios con rachas >= 60
  const { data: highStreaks, error: error1 } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak, longest_streak, last_activity_date')
    .gte('current_streak', 60)
    .order('current_streak', { ascending: false })

  if (error1) {
    console.error('Error:', error1)
    return
  }

  console.log(`\n📊 Usuarios con rachas de 60+ días: ${highStreaks.length}`)

  // Mostrar los primeros 5
  highStreaks.slice(0, 5).forEach(streak => {
    console.log(`\nUsuario: ${streak.user_id.substring(0, 8)}...`)
    console.log(`  Racha actual: ${streak.current_streak} días`)
    console.log(`  Racha más larga: ${streak.longest_streak} días`)
    console.log(`  Última actividad: ${streak.last_activity_date}`)
  })

  // 2. Verificar si hay un patrón en 60 días
  const exactly60 = highStreaks.filter(s => s.current_streak === 60)
  console.log(`\n⚠️ Usuarios con EXACTAMENTE 60 días: ${exactly60.length}`)

  if (exactly60.length > 0) {
    console.log('\n🚨 POSIBLE PROBLEMA: Múltiples usuarios con exactamente 60 días')
    console.log('Esto sugiere un límite artificial en el código')
  }

  // 3. Buscar el caso específico de Nila
  const { data: nilaProfile } = await supabase
    .from('public_user_profiles')
    .select('id, display_name')
    .eq('display_name', 'Nila')
    .single()

  if (nilaProfile) {
    const nilaStreak = highStreaks.find(s => s.user_id === nilaProfile.id)
    if (nilaStreak) {
      console.log(`\n👤 NILA específicamente:`)
      console.log(`  ID: ${nilaProfile.id}`)
      console.log(`  Racha actual: ${nilaStreak.current_streak} días`)
      console.log(`  Última actividad: ${nilaStreak.last_activity_date}`)

      // Calcular días desde última actividad
      const lastActivity = new Date(nilaStreak.last_activity_date)
      const today = new Date()
      const daysSinceActivity = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24))

      console.log(`  Días desde última actividad: ${daysSinceActivity}`)

      if (daysSinceActivity > 2) {
        console.log(`  ⚠️ PROBLEMA: Han pasado ${daysSinceActivity} días desde su última actividad`)
        console.log(`  La racha debería haberse roto (grace period = 1 día)`)
      }
    }
  }

  // 4. Verificar si hay algún trigger o función que actualice las rachas
  console.log('\n🔄 SISTEMA DE ACTUALIZACIÓN DE RACHAS:')
  console.log('Las rachas se actualizan mediante:')
  console.log('1. Trigger: update_user_streaks_trigger')
  console.log('2. Función: update_user_streak()')
  console.log('3. Se ejecuta al insertar en test_questions')

  // 5. Buscar límites en el código
  console.log('\n🔎 POSIBLES LÍMITES EN EL CÓDIGO:')
  console.log('Buscando referencias a "60" en funciones de racha...')

  // Verificar la función RPC
  const { data: rpcTest } = await supabase.rpc('get_user_public_stats', {
    p_user_id: nilaProfile?.id
  })

  if (rpcTest && rpcTest[0]) {
    console.log('\n📊 RPC get_user_public_stats devuelve:')
    console.log(`  current_streak: ${rpcTest[0].current_streak}`)
    console.log(`  longest_streak: ${rpcTest[0].longest_streak}`)
  }
}

checkStreaks().catch(console.error)