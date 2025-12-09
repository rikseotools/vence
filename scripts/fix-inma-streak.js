// Script para corregir las rachas incorrectas de Inma
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixInmaStreak() {
  try {
    const inmaId = '7194d681-0047-47da-8d2f-45634b2605a1'

    console.log('🔧 Corrigiendo rachas de Inma Corcuera...\n')

    // 1. Ver valores actuales
    const { data: before, error: beforeError } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', inmaId)
      .single()

    if (beforeError) {
      console.error('❌ Error:', beforeError)
      return
    }

    console.log('📋 ANTES DE LA CORRECCIÓN:')
    console.log(`  current_streak: ${before.current_streak}`)
    console.log(`  longest_streak: ${before.longest_streak}`)
    console.log(`  last_activity_date: ${before.last_activity_date}`)
    console.log(`  streak_start_date: ${before.streak_start_date}`)
    console.log('')

    // 2. Calcular valores correctos desde tests
    const { data: tests, error: testsError } = await supabase
      .from('tests')
      .select('completed_at')
      .eq('user_id', inmaId)
      .eq('is_completed', true)
      .order('completed_at', { ascending: true })

    if (testsError) {
      console.error('❌ Error obteniendo tests:', testsError)
      return
    }

    // Obtener días únicos
    const uniqueDays = new Set()
    tests.forEach(test => {
      if (test.completed_at) {
        const date = new Date(test.completed_at)
        const dayKey = date.toISOString().split('T')[0]
        uniqueDays.add(dayKey)
      }
    })

    const daysArray = Array.from(uniqueDays).sort()
    console.log('📅 Días con actividad:', daysArray)

    // Calcular racha real
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
        if (i === daysArray.length - 1) {
          currentStreakReal = 1 // Si el último día no es consecutivo
        }
      }
    }

    console.log('\n🔍 RACHAS REALES CALCULADAS:')
    console.log(`  Racha actual: ${currentStreakReal} días`)
    console.log(`  Mejor racha: ${longestStreakReal} días`)
    console.log('')

    // 3. Actualizar con valores correctos
    const lastActivityDate = daysArray[daysArray.length - 1]

    const { data: updated, error: updateError } = await supabase
      .from('user_streaks')
      .update({
        current_streak: currentStreakReal,
        longest_streak: longestStreakReal,
        last_activity_date: lastActivityDate
      })
      .eq('user_id', inmaId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error actualizando:', updateError)
      return
    }

    console.log('✅ CORRECCIÓN EXITOSA:')
    console.log(`  current_streak: ${updated.current_streak}`)
    console.log(`  longest_streak: ${updated.longest_streak}`)
    console.log(`  last_activity_date: ${updated.last_activity_date}`)

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

fixInmaStreak()
