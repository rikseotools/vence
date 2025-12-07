// Script para verificar usuarios con rachas altas
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function checkHighStreaks() {
  console.log('🔍 BUSCANDO USUARIOS CON RACHAS ALTAS\n')

  // Obtener usuarios con las rachas más altas
  const { data: streaks, error } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak, longest_streak, last_activity_date')
    .order('current_streak', { ascending: false })
    .limit(20)

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log(`📊 Top 20 rachas actuales:\n`)

  for (const streak of streaks) {
    // Obtener info del usuario
    const { data: profile } = await supabase
      .from('admin_users_with_roles')
      .select('email, full_name')
      .eq('user_id', streak.user_id)
      .single()

    const displayName = profile?.full_name || profile?.email?.split('@')[0] || streak.user_id.substring(0, 8)
    const email = profile?.email || 'N/A'

    console.log(`🔥 ${streak.current_streak} días - ${displayName} (${email.substring(0, 20)}...)`)
    console.log(`   Racha máxima: ${streak.longest_streak} días`)
    console.log(`   Última actividad: ${streak.last_activity_date}`)

    // Marcar si supera el límite de visualización
    if (streak.current_streak > 30) {
      console.log(`   ⚠️ VISUALIZACIÓN: Muestra "30+" en el header`)
    }
    console.log()
  }

  // Estadísticas generales
  const { data: stats } = await supabase
    .from('user_streaks')
    .select('current_streak')

  if (stats) {
    const over30 = stats.filter(s => s.current_streak > 30).length
    const total = stats.length

    console.log('═'.repeat(60))
    console.log('📊 ESTADÍSTICAS GENERALES:')
    console.log(`   Total usuarios con racha: ${total}`)
    console.log(`   Usuarios con racha > 30: ${over30}`)
    console.log(`   Porcentaje afectado por límite: ${((over30 / total) * 100).toFixed(2)}%`)
    console.log('═'.repeat(60))
  }
}

checkHighStreaks().catch(console.error)
