require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  // ID del test que vi en los logs de consola
  const testId = '58b93cfc-a8c8-4795-b1d9-e1bebb70a051'

  console.log('🔍 Verificando test:', testId, '\n')

  // Buscar test
  const { data: test, error: testError } = await supabase
    .from('tests')
    .select('*')
    .eq('id', testId)
    .single()

  if (testError) {
    console.error('❌ Error buscando test:', testError.message)
    console.log()
  }

  if (!test) {
    console.log('❌ Test NO EXISTE en tabla tests')
    console.log()
  } else {
    console.log('✅ TEST ENCONTRADO:')
    console.log('   ID:', test.id)
    console.log('   User ID:', test.user_id)
    console.log('   Creado:', new Date(test.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }))
    console.log('   Total preguntas:', test.total_questions)
    console.log('   is_completed:', test.is_completed)
    console.log('   Score:', test.score || 0)
    console.log()
  }

  // Buscar preguntas guardadas
  const { data: questions, error: questionsError } = await supabase
    .from('test_questions')
    .select('question_order, is_correct, created_at')
    .eq('test_id', testId)
    .order('question_order', { ascending: true })

  if (questionsError) {
    console.error('❌ Error buscando preguntas:', questionsError.message)
    return
  }

  console.log('📝 PREGUNTAS EN test_questions:', questions.length)

  if (questions.length > 0) {
    const orders = questions.map(q => q.question_order).sort((a, b) => a - b)
    const uniqueOrders = [...new Set(orders)]

    console.log('   Órdenes:', orders.join(', '))
    console.log()

    if (orders.length !== uniqueOrders.length) {
      console.log('   ❌ DUPLICADOS DETECTADOS!')
      const duplicates = orders.filter((o, i) => orders.indexOf(o) !== i)
      console.log('   Preguntas duplicadas:', [...new Set(duplicates)].join(', '))
    } else {
      console.log('   ✅ Sin duplicados')
    }

    console.log()
    console.log('📅 Timestamps:')
    questions.forEach(q => {
      const time = new Date(q.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
      console.log(`   Pregunta ${q.question_order}: ${time} - ${q.is_correct ? '✅' : '❌'}`)
    })

    // Calcular score
    const correctas = questions.filter(q => q.is_correct).length
    console.log()
    console.log('🎯 Score calculado:', correctas, '/', questions.length)
  } else {
    console.log('   ❌ No hay preguntas guardadas')
  }
}

main()
