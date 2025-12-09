// Script para encontrar TODOS los usuarios con rachas inválidas
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function findInvalidStreaks() {
  try {
    console.log('🔍 Buscando usuarios con rachas inválidas...\n')

    // 1. Obtener todos los usuarios con sus rachas
    const { data: streaks, error: streaksError } = await supabase
      .from('user_streaks')
      .select('user_id, current_streak, longest_streak, last_activity_date')

    if (streaksError) {
      console.error('❌ Error:', streaksError)
      return
    }

    console.log(`📊 Analizando ${streaks.length} usuarios...\n`)

    const invalidUsers = []

    for (const streak of streaks) {
      // Obtener fecha de creación del usuario
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, created_at')
        .eq('id', streak.user_id)
        .single()

      if (profileError || !profile) continue

      const createdDate = new Date(profile.created_at)
      const today = new Date()
      const daysSinceCreation = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24))

      // Verificar si la racha es inválida
      const hasInvalidCurrentStreak = streak.current_streak > daysSinceCreation
      const hasInvalidLongestStreak = streak.longest_streak > daysSinceCreation

      if (hasInvalidCurrentStreak || hasInvalidLongestStreak) {
        invalidUsers.push({
          name: profile.full_name,
          email: profile.email,
          id: profile.id,
          daysSinceCreation,
          current_streak: streak.current_streak,
          longest_streak: streak.longest_streak,
          hasInvalidCurrentStreak,
          hasInvalidLongestStreak
        })
      }
    }

    console.log(`⚠️ Encontrados ${invalidUsers.length} usuarios con rachas inválidas:\n`)

    if (invalidUsers.length === 0) {
      console.log('✅ No hay usuarios con rachas inválidas')
      return
    }

    invalidUsers.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.name} (${user.email})`)
      console.log(`   Días en plataforma: ${user.daysSinceCreation}`)
      console.log(`   Racha actual: ${user.current_streak} ${user.hasInvalidCurrentStreak ? '❌ INVÁLIDA' : '✅'}`)
      console.log(`   Mejor racha: ${user.longest_streak} ${user.hasInvalidLongestStreak ? '❌ INVÁLIDA' : '✅'}`)
      console.log('')
    })

    console.log(`\n📊 RESUMEN: ${invalidUsers.length} usuarios necesitan corrección`)

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

findInvalidStreaks()
