// Script para corregir TODOS los usuarios con rachas inválidas
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function calculateRealStreak(userId) {
  // Obtener todos los tests completados del usuario
  const { data: tests, error } = await supabase
    .from('tests')
    .select('completed_at')
    .eq('user_id', userId)
    .eq('is_completed', true)
    .order('completed_at', { ascending: true })

  if (error || !tests || tests.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActivityDate: null }
  }

  // Obtener días únicos con actividad
  const uniqueDays = new Set()
  tests.forEach(test => {
    if (test.completed_at) {
      const date = new Date(test.completed_at)
      const dayKey = date.toISOString().split('T')[0]
      uniqueDays.add(dayKey)
    }
  })

  const daysArray = Array.from(uniqueDays).sort()
  const lastActivityDate = daysArray[daysArray.length - 1]

  // Calcular racha actual y mejor racha
  let currentStreak = 1
  let longestStreak = 1
  let tempStreak = 1

  for (let i = 1; i < daysArray.length; i++) {
    const prevDay = new Date(daysArray[i - 1])
    const currDay = new Date(daysArray[i])
    const diffDays = Math.floor((currDay - prevDay) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      tempStreak++
      if (i === daysArray.length - 1) {
        currentStreak = tempStreak
      }
    } else {
      longestStreak = Math.max(longestStreak, tempStreak)
      tempStreak = 1
      if (i === daysArray.length - 1) {
        currentStreak = 1
      }
    }
  }

  longestStreak = Math.max(longestStreak, currentStreak)

  return { currentStreak, longestStreak, lastActivityDate }
}

async function fixAllInvalidStreaks() {
  try {
    console.log('🔧 Corrigiendo TODOS los usuarios con rachas inválidas...\n')

    // 1. Obtener todos los usuarios con rachas
    const { data: streaks, error: streaksError } = await supabase
      .from('user_streaks')
      .select('user_id, current_streak, longest_streak')

    if (streaksError) {
      console.error('❌ Error:', streaksError)
      return
    }

    const usersToFix = []

    // 2. Identificar usuarios con rachas inválidas
    for (const streak of streaks) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name, created_at')
        .eq('id', streak.user_id)
        .single()

      if (!profile) continue

      const daysSinceCreation = Math.floor((new Date() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24))

      if (streak.current_streak > daysSinceCreation || streak.longest_streak > daysSinceCreation) {
        usersToFix.push({
          userId: profile.id,
          name: profile.full_name,
          daysSinceCreation,
          oldCurrentStreak: streak.current_streak,
          oldLongestStreak: streak.longest_streak
        })
      }
    }

    console.log(`⚠️ Encontrados ${usersToFix.length} usuarios para corregir\n`)

    if (usersToFix.length === 0) {
      console.log('✅ No hay usuarios que corregir')
      return
    }

    // 3. Corregir cada usuario
    let fixed = 0
    for (const user of usersToFix) {
      console.log(`🔧 Corrigiendo ${user.name}...`)
      console.log(`   Antes: current=${user.oldCurrentStreak}, longest=${user.oldLongestStreak}`)

      // Calcular rachas reales
      const { currentStreak, longestStreak, lastActivityDate } = await calculateRealStreak(user.userId)

      console.log(`   Después: current=${currentStreak}, longest=${longestStreak}`)

      // Actualizar en BD
      const { error: updateError } = await supabase
        .from('user_streaks')
        .update({
          current_streak: currentStreak,
          longest_streak: longestStreak,
          last_activity_date: lastActivityDate
        })
        .eq('user_id', user.userId)

      if (updateError) {
        console.log(`   ❌ Error: ${updateError.message}`)
      } else {
        console.log(`   ✅ Corregido`)
        fixed++
      }
      console.log('')
    }

    console.log('═'.repeat(60))
    console.log(`📊 RESUMEN: ${fixed}/${usersToFix.length} usuarios corregidos exitosamente`)
    console.log('═'.repeat(60))

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

fixAllInvalidStreaks()
