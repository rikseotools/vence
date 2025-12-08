import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkStreakTables() {
  console.log('🔍 VERIFICANDO TABLAS DE RACHAS\n')
  console.log('='.repeat(60))

  // 1. Verificar si existe user_streaks
  console.log('1️⃣ Verificando tabla user_streaks:')
  const { data: streakData, error: streakError } = await supabase
    .from('user_streaks')
    .select('*')
    .limit(1)

  if (streakError) {
    if (streakError.message.includes('does not exist')) {
      console.log('❌ La tabla user_streaks NO EXISTE')
    } else {
      console.log('❌ Error:', streakError.message)
    }
  } else {
    console.log('✅ La tabla user_streaks existe')
  }

  // 2. Verificar si existe user_streak_stats (nombre alternativo)
  console.log('\n2️⃣ Verificando tabla user_streak_stats:')
  const { data: statsData, error: statsError } = await supabase
    .from('user_streak_stats')
    .select('*')
    .limit(5)

  if (statsError) {
    if (statsError.message.includes('does not exist')) {
      console.log('❌ La tabla user_streak_stats NO EXISTE')
    } else {
      console.log('❌ Error:', statsError.message)
    }
  } else {
    console.log('✅ La tabla user_streak_stats existe')
    console.log(`   Registros encontrados: ${statsData?.length || 0}`)

    if (statsData && statsData.length > 0) {
      console.log('\n   Muestra de datos:')
      statsData.forEach(row => {
        console.log(`   - Usuario: ${row.user_id?.substring(0, 8)}...`)
        console.log(`     Racha actual: ${row.current_streak || 0} días`)
        console.log(`     Racha más larga: ${row.longest_streak || 0} días`)
      })
    }
  }

  // 3. Calcular rachas manualmente desde tests
  console.log('\n3️⃣ Calculando rachas desde tabla tests:')

  // Obtener usuarios con actividad reciente
  const { data: recentUsers } = await supabase
    .from('tests')
    .select('user_id')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })

  const uniqueUsers = [...new Set(recentUsers?.map(t => t.user_id) || [])]
  console.log(`   Usuarios activos últimos 30 días: ${uniqueUsers.length}`)

  // Calcular racha para los primeros 5 usuarios
  const topUsers = uniqueUsers.slice(0, 5)

  for (const userId of topUsers) {
    // Obtener todos los tests del usuario
    const { data: userTests } = await supabase
      .from('tests')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (userTests && userTests.length > 0) {
      // Agrupar por día
      const days = new Set(userTests.map(t =>
        new Date(t.created_at).toISOString().split('T')[0]
      ))

      // Calcular racha
      const sortedDays = Array.from(days).sort().reverse()
      let streak = 0
      const today = new Date().toISOString().split('T')[0]
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

      if (sortedDays[0] === today || sortedDays[0] === yesterday) {
        let checkDate = new Date(sortedDays[0])

        for (const day of sortedDays) {
          const expectedDate = checkDate.toISOString().split('T')[0]
          if (day === expectedDate) {
            streak++
            checkDate.setDate(checkDate.getDate() - 1)
          } else {
            break
          }
        }
      }

      // Obtener email del usuario
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const userInfo = users.find(u => u.id === userId)

      console.log(`\n   Usuario: ${userInfo?.email || userId.substring(0, 8) + '...'}`)
      console.log(`   - Días con actividad: ${days.size}`)
      console.log(`   - Racha actual: ${streak} días`)
      console.log(`   - Último día activo: ${sortedDays[0]}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n💡 DIAGNÓSTICO:')

  if (!streakData && !statsData) {
    console.log('❌ No existe ninguna tabla de rachas')
    console.log('   El ranking está intentando leer de "user_streaks" que no existe')
    console.log('   Por eso solo muestra tu racha (calculada en el frontend)')
    console.log('\n✅ SOLUCIÓN: Crear la tabla user_streaks o')
    console.log('   cambiar RankingModal.js para calcular rachas directamente desde tests')
  }
}

checkStreakTables().catch(console.error)