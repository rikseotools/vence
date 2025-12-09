require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Buscando usuario Nila...\n')

  // Buscar usuario Nila
  const { data: users, error: userError } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .ilike('full_name', '%nila%')

  if (userError) {
    console.error('❌ Error buscando usuario:', userError)
    return
  }

  if (!users || users.length === 0) {
    console.log('❌ No se encontró usuario Nila')
    return
  }

  console.log('👤 Usuario(s) encontrado(s):')
  users.forEach(u => {
    console.log(`   - ${u.full_name} (${u.email}) - ID: ${u.id}`)
  })

  const nilaId = users[0].id

  // Tests de hoy en Madrid
  const nowMadrid = new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
  const madridDate = new Date(nowMadrid)
  const startOfDayMadrid = new Date(madridDate)
  startOfDayMadrid.setHours(0, 0, 0, 0)

  console.log('\n📅 Buscando tests de HOY (desde', startOfDayMadrid.toISOString(), ')\n')

  // Tests de Nila hoy
  const { data: todayTests, error: testsError } = await supabase
    .from('tests')
    .select('id, created_at, completed_at, is_completed, total_questions, score')
    .eq('user_id', nilaId)
    .gte('created_at', startOfDayMadrid.toISOString())
    .order('created_at', { ascending: false })

  if (testsError) {
    console.error('❌ Error obteniendo tests:', testsError)
    return
  }

  console.log(`📊 Tests de Nila hoy: ${todayTests.length}\n`)

  if (todayTests.length > 0) {
    todayTests.forEach((test, i) => {
      const created = new Date(test.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
      const completed = test.completed_at ? new Date(test.completed_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : 'NULL'

      console.log(`${i + 1}. Test ${test.id}`)
      console.log(`   Creado: ${created}`)
      console.log(`   Completado: ${completed}`)
      console.log(`   is_completed: ${test.is_completed}`)
      console.log(`   Score: ${test.score}/${test.total_questions}`)
      console.log(`   Estado: ${test.is_completed ? '✅ COMPLETADO' : '⚠️ NO COMPLETADO'}`)
      console.log()
    })

    // Verificar preguntas guardadas
    console.log('🔍 Verificando preguntas guardadas para cada test:\n')
    for (const test of todayTests) {
      const { count, error: countError } = await supabase
        .from('test_questions')
        .select('*', { count: 'exact', head: true })
        .eq('test_id', test.id)

      if (!countError) {
        const hasAll = count >= test.total_questions
        console.log(`Test ${test.id.substring(0, 8)}... → ${count}/${test.total_questions} preguntas ${hasAll ? '✅' : '❌'}`)
      }
    }
  } else {
    console.log('❌ Nila no ha hecho tests hoy')
  }
}

main()
