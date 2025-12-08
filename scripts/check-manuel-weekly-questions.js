import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkManuelQuestions() {
  console.log('🔍 VERIFICANDO PREGUNTAS DE MANUEL\n')
  console.log('='.repeat(60))

  const manuelId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'

  // 1. Obtener fecha actual en diferentes formatos
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayISO = today.toISOString()
  const tomorrowISO = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  console.log('📅 Fechas de referencia:')
  console.log(`Ahora: ${now.toLocaleString('es-ES')}`)
  console.log(`Hoy (inicio): ${today.toLocaleString('es-ES')}`)
  console.log(`Hace 7 días: ${new Date(weekAgo).toLocaleString('es-ES')}\n`)

  // 2. Verificar tests de HOY
  const { data: todayTests, error: todayError } = await supabase
    .from('tests')
    .select('id, created_at, total_questions, correct_answers')
    .eq('user_id', manuelId)
    .gte('created_at', todayISO)
    .lt('created_at', tomorrowISO)
    .order('created_at', { ascending: false })

  if (todayError) {
    console.log('❌ Error obteniendo tests de hoy:', todayError)
  } else {
    console.log('📊 TESTS DE HOY:')
    if (todayTests.length === 0) {
      console.log('   No hay tests hoy')
    } else {
      let totalQuestionsToday = 0
      todayTests.forEach(test => {
        const fecha = new Date(test.created_at).toLocaleString('es-ES')
        console.log(`   - Test ${test.id.substring(0, 8)}... creado a las ${fecha}`)
        console.log(`     Preguntas: ${test.total_questions}, Correctas: ${test.correct_answers}`)
        totalQuestionsToday += test.total_questions || 0
      })
      console.log(`   📝 Total preguntas hoy: ${totalQuestionsToday}`)
    }
  }

  // 3. Verificar tests de ESTA SEMANA
  const { data: weekTests, error: weekError } = await supabase
    .from('tests')
    .select('id, created_at, total_questions, correct_answers')
    .eq('user_id', manuelId)
    .gte('created_at', weekAgo)
    .order('created_at', { ascending: false })

  if (weekError) {
    console.log('❌ Error obteniendo tests de la semana:', weekError)
  } else {
    console.log('\n📊 TESTS DE ESTA SEMANA (últimos 7 días):')
    if (weekTests.length === 0) {
      console.log('   No hay tests esta semana')
    } else {
      let totalQuestionsWeek = 0
      const testsByDay = {}

      weekTests.forEach(test => {
        const fecha = new Date(test.created_at)
        const dayKey = fecha.toLocaleDateString('es-ES')

        if (!testsByDay[dayKey]) {
          testsByDay[dayKey] = { tests: 0, questions: 0 }
        }

        testsByDay[dayKey].tests++
        testsByDay[dayKey].questions += test.total_questions || 0
        totalQuestionsWeek += test.total_questions || 0
      })

      // Mostrar por día
      Object.keys(testsByDay).sort().reverse().forEach(day => {
        console.log(`   ${day}: ${testsByDay[day].tests} tests, ${testsByDay[day].questions} preguntas`)
      })

      console.log(`\n   📝 Total tests esta semana: ${weekTests.length}`)
      console.log(`   📝 Total preguntas esta semana: ${totalQuestionsWeek}`)
    }
  }

  // 4. Verificar qué devuelve la RPC actual
  console.log('\n🔧 VERIFICANDO RPC get_user_public_stats:')

  const { data: rpcStats, error: rpcError } = await supabase.rpc('get_user_public_stats', {
    p_user_id: manuelId
  })

  if (rpcError) {
    console.log('❌ Error llamando RPC:', rpcError)
  } else if (rpcStats && rpcStats[0]) {
    const stats = rpcStats[0]
    console.log('\n📊 Datos que devuelve la RPC:')
    console.log(`   total_questions: ${stats.total_questions}`)
    console.log(`   today_questions: ${stats.today_questions}`)
    console.log(`   today_tests: ${stats.today_tests}`)
    console.log(`   current_streak: ${stats.current_streak}`)
    console.log(`   global_accuracy: ${stats.global_accuracy}%`)

    // Verificar si existe questions_this_week
    if ('questions_this_week' in stats) {
      console.log(`   questions_this_week: ${stats.questions_this_week} ✅ EXISTE`)
    } else {
      console.log(`   questions_this_week: NO EXISTE ❌ <- ESTE ES EL PROBLEMA`)
    }

    // Mostrar todos los campos disponibles
    console.log('\n📋 TODOS los campos disponibles en la RPC:')
    Object.keys(stats).forEach(key => {
      if (!['user_id'].includes(key)) {
        console.log(`   - ${key}: ${stats[key]}`)
      }
    })
  }

  // 5. Calcular manualmente las preguntas de la semana
  console.log('\n🔧 CALCULANDO MANUALMENTE PREGUNTAS DE LA SEMANA:')

  const { data: manualCount } = await supabase
    .from('test_questions')
    .select('id', { count: 'exact', head: true })
    .in('test_id', weekTests?.map(t => t.id) || [])

  console.log(`   Preguntas respondidas esta semana (manual): ${manualCount || 0}`)

  console.log('\n' + '='.repeat(60))
  console.log('\n💡 DIAGNÓSTICO:')
  console.log('El campo "questions_this_week" NO existe en la RPC.')
  console.log('Por eso UserAvatar.js siempre muestra 0 en "Esta semana".')
  console.log('\n✅ Solución: Necesitamos actualizar la RPC o el componente.')
}

checkManuelQuestions().catch(console.error)