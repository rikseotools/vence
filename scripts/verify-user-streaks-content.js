import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function verifyUserStreaksContent() {
  console.log('🔍 CONTENIDO DE LA TABLA user_streaks\n')
  console.log('='.repeat(60))

  // 1. Contar registros totales
  const { count } = await supabase
    .from('user_streaks')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 Total de registros en user_streaks: ${count || 0}`)

  // 2. Obtener muestra de datos
  const { data: streaks, error } = await supabase
    .from('user_streaks')
    .select('*')
    .gte('current_streak', 1)
    .order('current_streak', { ascending: false })
    .limit(10)

  if (error) {
    console.log('❌ Error al leer user_streaks:', error.message)
    return
  }

  if (!streaks || streaks.length === 0) {
    console.log('\n⚠️  La tabla está VACÍA o no hay usuarios con racha >= 1')
    console.log('   Por eso el ranking de rachas no muestra a nadie\n')

    // Verificar si hay registros con racha 0
    const { data: zeroStreaks, count: zeroCount } = await supabase
      .from('user_streaks')
      .select('*', { count: 'exact' })
      .eq('current_streak', 0)
      .limit(5)

    if (zeroCount > 0) {
      console.log(`   Hay ${zeroCount} registros con racha = 0`)
    }
  } else {
    console.log('\n📋 Usuarios con rachas activas:')

    for (const streak of streaks) {
      // Intentar obtener info del usuario
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const userInfo = users.find(u => u.id === streak.user_id)

      console.log(`\n   ${userInfo?.email || 'Usuario ' + streak.user_id.substring(0, 8)}:`)
      console.log(`   - Racha actual: ${streak.current_streak} días`)
      console.log(`   - Última actualización: ${streak.last_activity_date || 'No registrada'}`)
    }
  }

  // 3. Verificar si Manuel está en la tabla
  const manuelId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'
  const { data: manuelStreak } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', manuelId)
    .single()

  console.log('\n' + '='.repeat(60))
  console.log('\n🔍 Tu registro (Manuel):')
  if (manuelStreak) {
    console.log(`   ✅ Existe en user_streaks`)
    console.log(`   - Racha actual: ${manuelStreak.current_streak}`)
    console.log(`   - Última actividad: ${manuelStreak.last_activity_date}`)
  } else {
    console.log(`   ❌ NO existe en user_streaks`)
  }

  console.log('\n💡 CONCLUSIÓN:')
  if (count === 0) {
    console.log('La tabla user_streaks existe pero está VACÍA')
    console.log('Necesitamos poblarla con datos o cambiar el componente')
  } else if (count > 0 && (!streaks || streaks.length === 0)) {
    console.log('La tabla tiene datos pero todas las rachas son 0')
    console.log('Necesitamos actualizar las rachas correctamente')
  } else {
    console.log('La tabla tiene datos pero puede que no estén actualizados')
  }
}

verifyUserStreaksContent().catch(console.error)