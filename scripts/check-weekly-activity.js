import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkWeeklyActivity() {
  console.log('🔍 VERIFICANDO ACTIVIDAD SEMANAL\n')
  console.log('='.repeat(60))

  const now = new Date()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  console.log('📅 Fechas de análisis:')
  console.log(`   Ahora: ${now.toISOString()}`)
  console.log(`   Hace 7 días: ${sevenDaysAgo.toISOString()}`)
  console.log('')

  // 1. Verificar usuarios con tests en los últimos 7 días
  console.log('1️⃣ USUARIOS CON TESTS EN ÚLTIMOS 7 DÍAS:')
  const { data: testsData, error: testsError } = await supabase
    .from('tests')
    .select('user_id, created_at')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })

  if (testsError) {
    console.error('Error obteniendo tests:', testsError)
    return
  }

  const uniqueUsersTests = new Set()
  testsData?.forEach(test => {
    uniqueUsersTests.add(test.user_id)
  })

  console.log(`   Total de tests: ${testsData?.length || 0}`)
  console.log(`   Usuarios únicos: ${uniqueUsersTests.size}`)
  console.log('')

  // 2. Verificar usuarios con test_questions en los últimos 7 días
  console.log('2️⃣ USUARIOS CON TEST_QUESTIONS EN ÚLTIMOS 7 DÍAS:')
  const { data: questionsData, error: questionsError } = await supabase
    .from('test_questions')
    .select('test_id, created_at, tests!inner(user_id)')
    .gte('created_at', sevenDaysAgo.toISOString())
    .limit(1000)

  if (questionsError) {
    console.error('Error obteniendo test_questions:', questionsError)
    return
  }

  const uniqueUsersQuestions = new Set()
  questionsData?.forEach(q => {
    if (q.tests?.user_id) {
      uniqueUsersQuestions.add(q.tests.user_id)
    }
  })

  console.log(`   Total de preguntas: ${questionsData?.length || 0}`)
  console.log(`   Usuarios únicos: ${uniqueUsersQuestions.size}`)
  console.log('')

  // 3. Llamar a la RPC como lo hace el componente
  console.log('3️⃣ RESULTADO DE LA RPC get_ranking_for_period:')
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_ranking_for_period', {
    p_start_date: sevenDaysAgo.toISOString(),
    p_end_date: null,
    p_min_questions: 5,
    p_limit: 100
  })

  if (rpcError) {
    console.error('Error en RPC:', rpcError)
    return
  }

  console.log(`   Usuarios devueltos por RPC: ${rpcData?.length || 0}`)
  if (rpcData && rpcData.length > 0) {
    console.log('   Primeros 5 usuarios:')
    rpcData.slice(0, 5).forEach((user, i) => {
      console.log(`     ${i + 1}. User ${user.user_id.substring(0, 8)}... - ${user.total_questions} preguntas, ${user.accuracy}% precisión`)
    })
  }
  console.log('')

  // 4. Verificar si hay discrepancia
  console.log('4️⃣ ANÁLISIS DE DISCREPANCIA:')
  console.log(`   Usuarios con tests: ${uniqueUsersTests.size}`)
  console.log(`   Usuarios con test_questions: ${uniqueUsersQuestions.size}`)
  console.log(`   Usuarios devueltos por RPC: ${rpcData?.length || 0}`)

  if (rpcData?.length < uniqueUsersTests.size) {
    console.log(`\n   ⚠️ PROBLEMA DETECTADO:`)
    console.log(`   La RPC está devolviendo menos usuarios de los que tienen actividad.`)
    console.log(`   Posibles causas:`)
    console.log(`   - El filtro p_min_questions=5 está excluyendo usuarios`)
    console.log(`   - Las fechas en test_questions no coinciden con tests`)
    console.log(`   - Problema de timezone en la comparación de fechas`)
  }

  // 5. Verificar usuarios específicos
  console.log('\n5️⃣ VERIFICACIÓN DE USUARIOS ESPECÍFICOS:')

  // Verificar Manuel
  const manuelId = 'df8ac1cf-c846-4709-acda-d4e4c4a8de77'
  const { data: manuelTests } = await supabase
    .from('tests')
    .select('id')
    .eq('user_id', manuelId)
    .gte('created_at', sevenDaysAgo.toISOString())

  const { data: manuelQuestions } = await supabase
    .from('test_questions')
    .select('id')
    .in('test_id', manuelTests?.map(t => t.id) || [])
    .gte('created_at', sevenDaysAgo.toISOString())

  console.log(`   Manuel:`)
  console.log(`     - Tests últimos 7 días: ${manuelTests?.length || 0}`)
  console.log(`     - Preguntas últimos 7 días: ${manuelQuestions?.length || 0}`)

  // Verificar Nila
  const nilaId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'
  const { data: nilaTests } = await supabase
    .from('tests')
    .select('id')
    .eq('user_id', nilaId)
    .gte('created_at', sevenDaysAgo.toISOString())

  const { data: nilaQuestions } = await supabase
    .from('test_questions')
    .select('id')
    .in('test_id', nilaTests?.map(t => t.id) || [])
    .gte('created_at', sevenDaysAgo.toISOString())

  console.log(`   Nila:`)
  console.log(`     - Tests últimos 7 días: ${nilaTests?.length || 0}`)
  console.log(`     - Preguntas últimos 7 días: ${nilaQuestions?.length || 0}`)
}

checkWeeklyActivity().catch(console.error)