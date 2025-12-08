import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyzeNilaRealStreak() {
  console.log('🔍 ANÁLISIS COMPLETO DE LA RACHA DE NILA\n')
  console.log('='.repeat(60))

  const nilaId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'

  // Obtener TODOS los tests de Nila
  const { data: tests } = await supabase
    .from('tests')
    .select('id, created_at')
    .eq('user_id', nilaId)
    .order('created_at', { ascending: false })

  if (!tests || tests.length === 0) {
    console.log('No hay tests para este usuario')
    return
  }

  // Agrupar por día
  const dayMap = {}
  tests.forEach(test => {
    const day = new Date(test.created_at).toISOString().split('T')[0]
    if (!dayMap[day]) {
      dayMap[day] = []
    }
    dayMap[day].push(test)
  })

  const uniqueDays = Object.keys(dayMap).sort().reverse()

  console.log(`📊 ESTADÍSTICAS GENERALES:`)
  console.log(`   Total de tests: ${tests.length}`)
  console.log(`   Días con actividad: ${uniqueDays.length}`)
  console.log(`   Primer test: ${uniqueDays[uniqueDays.length - 1]}`)
  console.log(`   Último test: ${uniqueDays[0]}`)

  // Mostrar los últimos 10 días con actividad
  console.log(`\n📅 ÚLTIMOS 10 DÍAS CON ACTIVIDAD:`)
  uniqueDays.slice(0, 10).forEach(day => {
    const testsCount = dayMap[day].length
    console.log(`   ${day}: ${testsCount} test(s)`)
  })

  // CALCULAR RACHA ACTUAL CORRECTAMENTE
  console.log(`\n🔥 CÁLCULO DE RACHA ACTUAL:`)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  console.log(`   Hoy: ${todayStr}`)
  console.log(`   Ayer: ${yesterdayStr}`)
  console.log(`   Último día con actividad: ${uniqueDays[0]}`)

  let currentStreak = 0
  let streakBroken = false

  // La racha debe empezar hoy o ayer
  if (uniqueDays[0] !== todayStr && uniqueDays[0] !== yesterdayStr) {
    console.log(`\n   ❌ Racha rota: No hay actividad hoy ni ayer`)
    currentStreak = 0
  } else {
    // Contar días consecutivos hacia atrás
    let checkDate = new Date(uniqueDays[0] + 'T00:00:00Z')

    for (let i = 0; i < 365; i++) {
      const checkStr = checkDate.toISOString().split('T')[0]

      if (uniqueDays.includes(checkStr)) {
        currentStreak++
        console.log(`   ✅ Día ${currentStreak}: ${checkStr} - Actividad encontrada`)
      } else {
        console.log(`   ❌ Día ${currentStreak + 1}: ${checkStr} - Sin actividad (racha termina aquí)`)
        break
      }

      checkDate.setUTCDate(checkDate.getUTCDate() - 1)
    }
  }

  console.log(`\n   🎯 RACHA ACTUAL REAL: ${currentStreak} días`)

  // CALCULAR RACHA MÁS LARGA HISTÓRICA
  console.log(`\n📈 CÁLCULO DE RACHA MÁS LARGA:`)

  let longestStreak = 0
  let currentLongestStreak = 0
  let previousDay = null

  // Recorrer todos los días en orden cronológico
  const chronologicalDays = uniqueDays.reverse()

  for (const day of chronologicalDays) {
    if (!previousDay) {
      currentLongestStreak = 1
    } else {
      const prevDate = new Date(previousDay + 'T00:00:00Z')
      const currDate = new Date(day + 'T00:00:00Z')
      const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24))

      if (diffDays === 1) {
        currentLongestStreak++
      } else {
        longestStreak = Math.max(longestStreak, currentLongestStreak)
        currentLongestStreak = 1
      }
    }
    previousDay = day
  }

  longestStreak = Math.max(longestStreak, currentLongestStreak)

  console.log(`   🏆 Racha más larga histórica: ${longestStreak} días`)

  // COMPARAR CON LA BASE DE DATOS
  console.log(`\n📊 COMPARACIÓN CON BASE DE DATOS:`)

  const { data: streakData } = await supabase
    .from('user_streaks')
    .select('current_streak, last_activity_date')
    .eq('user_id', nilaId)
    .single()

  console.log(`\n   Tabla user_streaks dice:`)
  console.log(`   - Racha actual: ${streakData?.current_streak || 0} días`)
  console.log(`   - Última actualización: ${streakData?.last_activity_date || 'N/A'}`)

  console.log(`\n   Cálculo real dice:`)
  console.log(`   - Racha actual: ${currentStreak} días`)
  console.log(`   - Racha más larga: ${longestStreak} días`)

  if (streakData?.current_streak !== currentStreak) {
    console.log(`\n   ⚠️  HAY UNA DISCREPANCIA!`)
    console.log(`   La tabla user_streaks está DESACTUALIZADA o mal calculada`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n💡 CONCLUSIÓN:')
  console.log(`La racha REAL de Nila es ${currentStreak} días, no ${streakData?.current_streak} días`)
  console.log('El problema es que user_streaks no se está actualizando correctamente')
}

analyzeNilaRealStreak().catch(console.error)