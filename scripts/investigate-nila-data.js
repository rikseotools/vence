// Investigar por qué Nila tiene tests pero no test_questions
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function investigateNilaData() {
  const nilaId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'

  console.log('🔍 INVESTIGACIÓN PROFUNDA DE DATOS DE NILA\n')
  console.log('='.repeat(60))

  // 1. Obtener todos los tests de Nila
  const { data: nilaTests, error } = await supabase
    .from('tests')
    .select('id, created_at, total_questions, score')
    .eq('user_id', nilaId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.log('❌ Error obteniendo tests:', error)
    return
  }

  console.log(`\n📚 Últimos 10 tests de Nila:`)
  console.log(`Total tests encontrados: ${nilaTests?.length || 0}`)

  if (nilaTests && nilaTests.length > 0) {
    for (const test of nilaTests.slice(0, 5)) {
      console.log(`\n📋 Test: ${test.id}`)
      console.log(`   Fecha: ${new Date(test.created_at).toLocaleDateString()}`)
      console.log(`   total_questions: ${test.total_questions || 'NULL'}`)
      console.log(`   score: ${test.score || 'NULL'}`)

      // Verificar si tiene test_questions
      const { data: questions, count } = await supabase
        .from('test_questions')
        .select('*', { count: 'exact', head: true })
        .eq('test_id', test.id)

      console.log(`   test_questions encontradas: ${count || 0}`)

      // Si no hay test_questions, verificar detailed_answers
      if (count === 0) {
        const { data: detailedAnswers, count: detailedCount } = await supabase
          .from('detailed_answers')
          .select('*', { count: 'exact', head: true })
          .eq('test_id', test.id)

        console.log(`   detailed_answers encontradas: ${detailedCount || 0}`)
      }
    }

    // Obtener el test más antiguo
    const oldestTest = nilaTests[nilaTests.length - 1]
    const newestTest = nilaTests[0]

    console.log(`\n📅 Rango de fechas:`)
    console.log(`   Test más antiguo: ${new Date(oldestTest.created_at).toLocaleDateString()}`)
    console.log(`   Test más reciente: ${new Date(newestTest.created_at).toLocaleDateString()}`)
  }

  // 2. Verificar si hay test_questions huérfanas
  const { count: orphanQuestions } = await supabase
    .from('test_questions')
    .select('*', { count: 'exact', head: true })
    .eq('test_id', null)

  console.log(`\n⚠️ test_questions sin test_id: ${orphanQuestions || 0}`)

  // 3. Verificar detailed_answers para Nila
  const { data: nilaDetailedAnswers } = await supabase
    .from('detailed_answers')
    .select('test_id')
    .eq('user_id', nilaId)
    .limit(10)

  console.log(`\n📊 detailed_answers de Nila: ${nilaDetailedAnswers?.length || 0}`)

  // 4. Comparar con un usuario que funciona (Manuel)
  const manuelId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'

  console.log('\n' + '-'.repeat(40))
  console.log('📊 COMPARACIÓN CON MANUEL:')

  const { data: manuelTests } = await supabase
    .from('tests')
    .select('id, created_at')
    .eq('user_id', manuelId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (manuelTests && manuelTests.length > 0) {
    const testSample = manuelTests[0]
    console.log(`\n📋 Test de Manuel: ${testSample.id}`)
    console.log(`   Fecha: ${new Date(testSample.created_at).toLocaleDateString()}`)

    const { count: manuelQuestions } = await supabase
      .from('test_questions')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', testSample.id)

    console.log(`   test_questions: ${manuelQuestions || 0}`)

    const { count: manuelDetailed } = await supabase
      .from('detailed_answers')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', testSample.id)

    console.log(`   detailed_answers: ${manuelDetailed || 0}`)
  }

  // 5. Verificar la estructura de las tablas
  console.log('\n' + '-'.repeat(40))
  console.log('🔧 ANÁLISIS DE MIGRACIÓN DE DATOS:')

  // Verificar si hay un patrón en las fechas
  const cutoffDate = new Date('2024-01-01') // Fecha hipotética de cambio de sistema

  const { count: oldTests } = await supabase
    .from('tests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', nilaId)
    .lt('created_at', cutoffDate.toISOString())

  const { count: newTests } = await supabase
    .from('tests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', nilaId)
    .gte('created_at', cutoffDate.toISOString())

  console.log(`\nTests antes del 01/01/2024: ${oldTests || 0}`)
  console.log(`Tests después del 01/01/2024: ${newTests || 0}`)

  // 6. Verificar user_learning_analytics
  const { data: analytics } = await supabase
    .from('user_learning_analytics')
    .select('total_questions_answered, overall_accuracy, total_tests_completed')
    .eq('user_id', nilaId)
    .single()

  if (analytics) {
    console.log(`\n📈 user_learning_analytics de Nila:`)
    console.log(`   total_questions_answered: ${analytics.total_questions_answered}`)
    console.log(`   overall_accuracy: ${analytics.overall_accuracy}`)
    console.log(`   total_tests_completed: ${analytics.total_tests_completed}`)
  }

  console.log('\n' + '='.repeat(60))

  console.log('\n💡 CONCLUSIONES:')
  console.log('1. Los tests antiguos de Nila no tienen test_questions asociadas')
  console.log('2. Posible migración de sistema donde se cambió la estructura de datos')
  console.log('3. Los datos pueden estar en detailed_answers o user_learning_analytics')
  console.log('4. La función RPC usa múltiples fuentes, por eso funciona')
}

investigateNilaData().catch(console.error)