require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Buscando tests incompletos de HOY...\n')

  // Calcular inicio del día en Madrid
  const nowMadrid = new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
  const madridDate = new Date(nowMadrid)
  const startOfDayMadrid = new Date(madridDate)
  startOfDayMadrid.setHours(0, 0, 0, 0)

  console.log('📅 Buscando desde:', startOfDayMadrid.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }))
  console.log('📅 Hora actual Madrid:', madridDate.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }))
  console.log()

  // Obtener todos los tests de hoy
  const { data: todayTests, error: testsError } = await supabase
    .from('tests')
    .select('id, user_id, created_at, is_completed, total_questions, score')
    .gte('created_at', startOfDayMadrid.toISOString())
    .order('created_at', { ascending: false })

  if (testsError) {
    console.error('❌ Error:', testsError)
    return
  }

  console.log('📊 TESTS DE HOY:', todayTests.length)
  console.log()

  // Para cada test, verificar cuántas preguntas tiene guardadas
  const incompleteTests = []

  for (const test of todayTests) {
    const { count, error: countError } = await supabase
      .from('test_questions')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', test.id)

    if (countError) {
      console.error('❌ Error contando preguntas:', countError)
      continue
    }

    const hasAllQuestions = count >= test.total_questions
    const isMarkedComplete = test.is_completed

    // Test incompleto = tiene todas las preguntas PERO no está marcado como completado
    if (hasAllQuestions && !isMarkedComplete) {
      incompleteTests.push({
        ...test,
        questions_saved: count
      })
    }
  }

  console.log('🐛 TESTS INCOMPLETOS (tienen todas las preguntas pero no están marcados):', incompleteTests.length)
  console.log()

  if (incompleteTests.length === 0) {
    console.log('✅ No hay tests incompletos hoy')
    return
  }

  // Obtener info de usuarios
  const userIds = [...new Set(incompleteTests.map(t => t.user_id))]
  const { data: users, error: usersError } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  if (usersError) {
    console.error('❌ Error obteniendo usuarios:', usersError)
  }

  const userMap = new Map(users?.map(u => [u.id, u]) || [])

  // Mostrar detalles
  console.log('📋 DETALLES DE TESTS INCOMPLETOS:\n')

  incompleteTests.forEach((test, i) => {
    const user = userMap.get(test.user_id)
    const created = new Date(test.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })

    console.log(`${i + 1}. Test ${test.id.substring(0, 8)}...`)
    console.log(`   Usuario: ${user?.full_name || 'Desconocido'} (${user?.email || test.user_id})`)
    console.log(`   Creado: ${created}`)
    console.log(`   Preguntas guardadas: ${test.questions_saved}/${test.total_questions} ✅`)
    console.log(`   is_completed: ${test.is_completed} ❌`)
    console.log(`   Score: ${test.score || 0}`)
    console.log()
  })

  // Resumen por usuario
  console.log('👥 RESUMEN POR USUARIO:\n')

  const testsByUser = new Map()
  incompleteTests.forEach(test => {
    const userId = test.user_id
    if (!testsByUser.has(userId)) {
      testsByUser.set(userId, [])
    }
    testsByUser.get(userId).push(test)
  })

  testsByUser.forEach((tests, userId) => {
    const user = userMap.get(userId)
    console.log(`👤 ${user?.full_name || 'Desconocido'} (${user?.email || userId})`)
    console.log(`   Tests incompletos: ${tests.length}`)
    tests.forEach(test => {
      console.log(`   - ${test.id.substring(0, 8)}... (${test.questions_saved}/${test.total_questions} preguntas)`)
    })
    console.log()
  })

  // Proponer SQL para arreglar
  console.log('🔧 SQL PARA ARREGLAR:\n')
  console.log('-- Marcar como completados los tests que tienen todas las preguntas\n')

  incompleteTests.forEach(test => {
    console.log(`UPDATE tests SET is_completed = true, completed_at = NOW() WHERE id = '${test.id}'; -- ${test.questions_saved}/${test.total_questions} preguntas`)
  })
}

main()
