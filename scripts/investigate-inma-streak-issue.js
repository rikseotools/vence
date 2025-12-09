// Script para investigar el problema de racha de Inma
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function investigateInmaStreak() {
  try {
    console.log('🔍 Investigando problema de racha de Inma...\n')

    // 1. Buscar a Inma en la base de datos
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, created_at')
      .or('full_name.ilike.%Inma%,email.ilike.%inma%')
      .order('created_at', { ascending: false })

    if (usersError) {
      console.error('❌ Error buscando usuarios:', usersError)
      return
    }

    console.log(`📊 Encontrados ${users.length} usuarios con nombre Inma:\n`)

    for (const user of users) {
      console.log(`Usuario: ${user.full_name}`)
      console.log(`  ID: ${user.id}`)
      console.log(`  Email: ${user.email}`)
      console.log(`  Creado: ${user.created_at}`)

      // Calcular días desde creación
      const createdDate = new Date(user.created_at)
      const today = new Date()
      const daysSinceCreation = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24))
      console.log(`  📅 Días desde creación: ${daysSinceCreation} días`)

      // Obtener estadísticas públicas
      const { data: stats, error: statsError } = await supabase.rpc('get_user_public_stats', {
        p_user_id: user.id
      })

      if (statsError) {
        console.error('  ❌ Error obteniendo stats:', statsError)
        continue
      }

      if (stats && stats.length > 0) {
        const userStats = stats[0]
        console.log(`  🔥 Racha actual: ${userStats.streak} días`)
        console.log(`  🏆 Mejor racha: ${userStats.longest_streak} días`)
        console.log(`  ⏰ Tiempo en Vence: ${userStats.time_in_vence}`)
        console.log(`  📊 Preguntas totales: ${userStats.total_questions}`)
        console.log(`  ✅ Tests completados: ${userStats.total_tests_completed}`)

        // Verificar inconsistencia
        if (userStats.streak > daysSinceCreation) {
          console.log(`  ⚠️ INCONSISTENCIA DETECTADA:`)
          console.log(`     Racha actual (${userStats.streak} días) > Días en plataforma (${daysSinceCreation} días)`)
        }

        if (userStats.longest_streak > daysSinceCreation) {
          console.log(`  ⚠️ INCONSISTENCIA DETECTADA:`)
          console.log(`     Mejor racha (${userStats.longest_streak} días) > Días en plataforma (${daysSinceCreation} días)`)
        }
      }

      // Verificar tabla user_streaks
      const { data: streaks, error: streaksError } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (streaksError) {
        console.log('  ⚠️ No hay datos en user_streaks')
      } else if (streaks) {
        console.log(`\n  📊 Datos en user_streaks:`)
        console.log(`     current_streak: ${streaks.current_streak}`)
        console.log(`     longest_streak: ${streaks.longest_streak}`)
        console.log(`     last_activity_date: ${streaks.last_activity_date}`)
        console.log(`     streak_start_date: ${streaks.streak_start_date}`)

        if (streaks.streak_start_date) {
          const streakStart = new Date(streaks.streak_start_date)
          const streakDuration = Math.floor((today - streakStart) / (1000 * 60 * 60 * 24)) + 1
          console.log(`     Duración calculada desde streak_start_date: ${streakDuration} días`)

          if (streakStart < createdDate) {
            console.log(`     ⚠️ PROBLEMA: streak_start_date (${streaks.streak_start_date}) es ANTERIOR a created_at (${user.created_at})`)
          }
        }
      }

      // Verificar actividad diaria (tests completados por día)
      const { data: tests, error: testsError } = await supabase
        .from('tests')
        .select('completed_at')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .order('completed_at', { ascending: true })

      if (!testsError && tests && tests.length > 0) {
        console.log(`\n  📅 Actividad diaria:`)

        // Contar días únicos con actividad
        const uniqueDays = new Set()
        tests.forEach(test => {
          if (test.completed_at) {
            const date = new Date(test.completed_at)
            const dayKey = date.toISOString().split('T')[0]
            uniqueDays.add(dayKey)
          }
        })

        console.log(`     Días únicos con actividad: ${uniqueDays.size} días`)
        console.log(`     Total tests completados: ${tests.length}`)
        console.log(`     Primer test: ${tests[0].completed_at}`)
        console.log(`     Último test: ${tests[tests.length - 1].completed_at}`)

        // Verificar racha real (días consecutivos)
        const daysArray = Array.from(uniqueDays).sort()
        let currentStreakReal = 1
        let longestStreakReal = 1
        let tempStreak = 1

        for (let i = 1; i < daysArray.length; i++) {
          const prevDay = new Date(daysArray[i - 1])
          const currDay = new Date(daysArray[i])
          const diffDays = Math.floor((currDay - prevDay) / (1000 * 60 * 60 * 24))

          if (diffDays === 1) {
            tempStreak++
            if (i === daysArray.length - 1) {
              currentStreakReal = tempStreak
            }
          } else {
            longestStreakReal = Math.max(longestStreakReal, tempStreak)
            tempStreak = 1
          }
        }

        console.log(`\n  🔍 RACHA REAL CALCULADA:`)
        console.log(`     Racha actual real: ${currentStreakReal} días`)
        console.log(`     Mejor racha real: ${longestStreakReal} días`)

        if (stats && stats.length > 0 && currentStreakReal !== stats[0].streak) {
          console.log(`     ⚠️ DISCREPANCIA: RPC dice ${stats[0].streak || 'undefined'} pero debería ser ${currentStreakReal}`)
        }
      }

      console.log('\n' + '='.repeat(80) + '\n')
    }

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

investigateInmaStreak()
