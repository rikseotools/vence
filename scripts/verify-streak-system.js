import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verifyStreakSystem() {
  console.log('🔍 VERIFICANDO SISTEMA DE RACHAS\n')
  console.log('='.repeat(60))

  // 1. Buscar usuarios con diferentes rachas
  const { data: streaks } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak, last_activity_date')
    .order('current_streak', { ascending: false })
    .limit(10)

  console.log('📊 TOP 10 RACHAS:')
  streaks.forEach(s => {
    const lastActivity = new Date(s.last_activity_date)
    const today = new Date()
    const daysSince = Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24))

    console.log(`  Racha: ${s.current_streak} días, Última: ${s.last_activity_date} (hace ${daysSince} días)`)
  })

  // 2. Analizar el patrón
  const exactly60 = streaks.filter(s => s.current_streak === 60).length
  const over60 = streaks.filter(s => s.current_streak > 60).length
  const under60 = streaks.filter(s => s.current_streak < 60).length

  console.log('\n📈 DISTRIBUCIÓN:')
  console.log(`  - Exactamente 60: ${exactly60} usuarios`)
  console.log(`  - Más de 60: ${over60} usuarios`)
  console.log(`  - Menos de 60: ${under60} usuarios`)

  if (over60 === 0 && exactly60 > 0) {
    console.log('\n⚠️ LÍMITE DE 60 DÍAS CONFIRMADO')
    console.log('Nadie tiene más de 60 días, pero hay usuarios en 60')
    console.log('Esto confirma que hay un tope artificial')
  }

  // 3. Verificar usuarios con actividad reciente
  console.log('\n🔄 USUARIOS CON ACTIVIDAD HOY/AYER:')

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const recentActivity = streaks.filter(s =>
    s.last_activity_date === today || s.last_activity_date === yesterday
  )

  recentActivity.forEach(s => {
    console.log(`  Usuario: ${s.user_id.substring(0, 8)}...`)
    console.log(`    Racha: ${s.current_streak} días`)
    console.log(`    Última actividad: ${s.last_activity_date}`)

    if (s.current_streak === 60 && s.last_activity_date === today) {
      console.log(`    ⚠️ PROBLEMA: Activo hoy pero atascado en 60`)
    }
  })

  // 4. Conclusión
  console.log('\n' + '='.repeat(60))
  console.log('💡 CONCLUSIÓN:')

  if (over60 === 0 && exactly60 > 0) {
    console.log('✅ El sistema SÍ actualiza rachas automáticamente')
    console.log('❌ PERO tiene un límite hardcodeado de 60 días')
    console.log('\nSOLUCIÓN: Encontrar y quitar el límite de 60 días en:')
    console.log('  1. El trigger/función de la base de datos')
    console.log('  2. O el proceso que actualiza user_streaks')
  } else if (over60 > 0) {
    console.log('✅ NO hay límite de 60 días')
    console.log('El sistema funciona correctamente')
  } else {
    console.log('⚠️ Necesito más datos para determinar el problema')
  }
}

verifyStreakSystem().catch(console.error)