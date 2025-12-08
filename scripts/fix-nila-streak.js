import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixNilaStreak() {
  console.log('🔧 ACTUALIZANDO RACHA DE NILA\n')
  console.log('='.repeat(60))

  // 1. Obtener el ID de Nila
  const { data: nilaProfile } = await supabase
    .from('public_user_profiles')
    .select('id, display_name')
    .eq('display_name', 'Nila')
    .single()

  if (!nilaProfile) {
    console.error('No se encontró a Nila')
    return
  }

  console.log(`👤 Usuario: ${nilaProfile.display_name} (${nilaProfile.id.substring(0, 8)}...)`)

  // 2. Contar días reales de actividad consecutiva
  const { data: allTests } = await supabase
    .from('tests')
    .select('created_at')
    .eq('user_id', nilaProfile.id)
    .order('created_at', { ascending: false })

  if (!allTests || allTests.length === 0) {
    console.log('No hay tests')
    return
  }

  // Agrupar por día
  const dayMap = new Map()
  allTests.forEach(test => {
    const date = new Date(test.created_at)
    const dayKey = date.toISOString().split('T')[0]
    dayMap.set(dayKey, true)
  })

  // Ordenar días
  const sortedDays = Array.from(dayMap.keys()).sort().reverse()
  console.log(`\n📅 Total de días con actividad: ${sortedDays.length}`)
  console.log(`   Primer día: ${sortedDays[sortedDays.length - 1]}`)
  console.log(`   Último día: ${sortedDays[0]}`)

  // Calcular racha real (con día de gracia)
  let currentStreak = 0
  let checkDate = new Date()
  checkDate.setHours(0, 0, 0, 0)
  let graceDaysUsed = 0

  for (let i = 0; i < 365; i++) { // Revisar hasta 365 días
    const dateStr = checkDate.toISOString().split('T')[0]

    if (dayMap.has(dateStr)) {
      currentStreak++
      graceDaysUsed = 0 // Reset grace days
    } else {
      graceDaysUsed++
      if (graceDaysUsed > 1) {
        // Racha rota
        break
      }
      // Día de gracia, continuar
    }

    checkDate.setDate(checkDate.getDate() - 1)
  }

  console.log(`\n🔥 RACHA REAL CALCULADA: ${currentStreak} días`)

  // 3. Actualizar en la base de datos
  const { data: currentData } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', nilaProfile.id)
    .single()

  console.log(`\n📊 Datos actuales en BD:`)
  console.log(`   - Racha actual: ${currentData?.current_streak || 0}`)
  console.log(`   - Racha más larga: ${currentData?.longest_streak || 0}`)

  if (currentStreak > 60) {
    console.log(`\n✅ ACTUALIZANDO RACHA A ${currentStreak} DÍAS...`)

    const { error } = await supabase
      .from('user_streaks')
      .upsert({
        user_id: nilaProfile.id,
        current_streak: currentStreak,
        longest_streak: Math.max(currentStreak, currentData?.longest_streak || 0),
        last_activity_date: sortedDays[0]
      })

    if (error) {
      console.error('Error actualizando:', error)
    } else {
      console.log('✅ Racha actualizada correctamente!')
    }
  } else {
    console.log('\n⚠️ La racha real no supera los 60 días')
    console.log('Posiblemente Nila no ha estudiado más de 60 días consecutivos')
  }
}

fixNilaStreak().catch(console.error)