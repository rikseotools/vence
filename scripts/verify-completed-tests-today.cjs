require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Verificando tests completados de HOY...\n')

  // Calcular inicio del día en Madrid (igual que el dashboard)
  const nowMadrid = new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
  const madridDate = new Date(nowMadrid)
  const startOfDayMadrid = new Date(madridDate)
  startOfDayMadrid.setHours(0, 0, 0, 0)

  console.log('📅 Fecha Madrid:', madridDate.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }))
  console.log('🕐 Inicio día Madrid (UTC):', startOfDayMadrid.toISOString())
  console.log()

  // Query EXACTA del dashboard (con created_at)
  const { data: todayTests, error } = await supabase
    .from('tests')
    .select('id, created_at, completed_at, score, total_questions, user_id, is_completed')
    .eq('is_completed', true)
    .gte('created_at', startOfDayMadrid.toISOString())
    .order('completed_at', { ascending: false })

  if (error) {
    console.error('❌ Error:', error)
    return
  }

  console.log('📊 TESTS COMPLETADOS HOY (is_completed=true + created_at >= hoy):', todayTests.length)
  console.log()

  if (todayTests.length === 0) {
    console.log('❌ No se encontraron tests completados hoy')
    return
  }

  // Obtener info de usuarios
  const userIds = [...new Set(todayTests.map(t => t.user_id))]
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  const userMap = new Map(users?.map(u => [u.id, u]) || [])

  // Mostrar cada test
  console.log('📋 LISTA DE TESTS:\n')

  todayTests.forEach((test, i) => {
    const user = userMap.get(test.user_id)
    const created = new Date(test.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
    const completed = test.completed_at ? new Date(test.completed_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : 'NULL'

    console.log(`${i + 1}. ${test.id.substring(0, 8)}...`)
    console.log(`   Usuario: ${user?.full_name || 'Desconocido'}`)
    console.log(`   Creado: ${created}`)
    console.log(`   Completado: ${completed}`)
    console.log(`   Score: ${test.score}/${test.total_questions}`)
    console.log()
  })

  // Resumen por usuario
  console.log('👥 RESUMEN POR USUARIO:\n')

  const testsByUser = new Map()
  todayTests.forEach(test => {
    const userId = test.user_id
    if (!testsByUser.has(userId)) {
      testsByUser.set(userId, [])
    }
    testsByUser.get(userId).push(test)
  })

  testsByUser.forEach((tests, userId) => {
    const user = userMap.get(userId)
    console.log(`👤 ${user?.full_name || 'Desconocido'} (${user?.email || userId})`)
    console.log(`   Tests completados hoy: ${tests.length}`)
    console.log()
  })

  console.log('📊 TOTAL:', todayTests.length, 'tests completados hoy')
}

main()
