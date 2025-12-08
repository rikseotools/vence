import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugNilaStreak() {
  console.log('🔍 DEBUG: Racha de Nila\n')
  console.log('='.repeat(60))

  const nilaId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'

  // 1. Racha en user_streaks
  console.log('1️⃣ Tabla user_streaks:')
  const { data: streakData } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', nilaId)
    .single()

  if (streakData) {
    console.log(`   Racha actual: ${streakData.current_streak} días`)
    console.log(`   Última actividad: ${streakData.last_activity_date}`)
  }

  // 2. Racha desde RPC
  console.log('\n2️⃣ RPC get_user_public_stats:')
  const { data: rpcData } = await supabase.rpc('get_user_public_stats', {
    p_user_id: nilaId
  })

  if (rpcData && rpcData[0]) {
    console.log(`   Racha actual: ${rpcData[0].current_streak} días`)
    console.log(`   Racha más larga: ${rpcData[0].longest_streak} días`)
  }

  // 3. Calcular manualmente desde tests
  console.log('\n3️⃣ Cálculo manual desde tests:')

  // Obtener todos los tests de Nila
  const { data: tests } = await supabase
    .from('tests')
    .select('id, created_at')
    .eq('user_id', nilaId)
    .order('created_at', { ascending: false })

  if (tests && tests.length > 0) {
    // Agrupar por día
    const uniqueDays = new Set()
    tests.forEach(test => {
      const day = new Date(test.created_at).toISOString().split('T')[0]
      uniqueDays.add(day)
    })

    const sortedDays = Array.from(uniqueDays).sort().reverse()

    console.log(`   Total de tests: ${tests.length}`)
    console.log(`   Días con actividad: ${uniqueDays.size}`)
    console.log(`   Últimos 5 días activos:`)
    sortedDays.slice(0, 5).forEach(day => {
      console.log(`     - ${day}`)
    })

    // Calcular racha real
    let streak = 0
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    console.log(`\n   Hoy es: ${today}`)
    console.log(`   Ayer fue: ${yesterday}`)
    console.log(`   Último día activo: ${sortedDays[0]}`)

    // Ver si la racha continúa desde hoy o ayer
    if (sortedDays[0] === today || sortedDays[0] === yesterday) {
      let checkDate = new Date(sortedDays[0] + 'T00:00:00Z')

      for (let i = 0; i < sortedDays.length; i++) {
        const expectedDate = checkDate.toISOString().split('T')[0]
        if (sortedDays.includes(expectedDate)) {
          streak++
          checkDate.setUTCDate(checkDate.getUTCDate() - 1)
        } else {
          break
        }
      }
    }

    console.log(`\n   💡 Racha REAL calculada: ${streak} días`)
  }

  // 4. Verificar el problema en la RPC
  console.log('\n4️⃣ Analizando el problema:')
  console.log('   La RPC probablemente está:')
  console.log('   - Usando CURRENT_DATE que puede tener problemas de timezone')
  console.log('   - O el cálculo de generate_series está mal')
  console.log('   - O no está encontrando los días correctamente')

  console.log('\n' + '='.repeat(60))
  console.log('\n💡 RESUMEN:')
  console.log(`user_streaks dice: ${streakData?.current_streak || 0} días`)
  console.log(`RPC dice: ${rpcData?.[0]?.current_streak || 0} días`)
  console.log(`Cálculo manual: Se necesita revisar la lógica`)
}

debugNilaStreak().catch(console.error)