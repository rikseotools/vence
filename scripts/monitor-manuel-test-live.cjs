require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Monitoreando tests de Manuel en tiempo real...\n')
  console.log('📝 Haz tu test ahora. Presiona Ctrl+C para parar.\n')

  // Buscar usuario Manuel
  const { data: users, error: userError } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .ilike('full_name', '%manuel%')

  if (userError || !users || users.length === 0) {
    console.error('❌ No se encontró usuario Manuel')
    return
  }

  const manuelId = users[0].id
  console.log('👤 Usuario:', users[0].full_name, `(${users[0].email})`)
  console.log('🆔 ID:', manuelId)
  console.log()

  let lastTestId = null
  let lastQuestionCount = 0

  // Monitorear cada 2 segundos
  setInterval(async () => {
    // Test más reciente
    const { data: latestTest } = await supabase
      .from('tests')
      .select('id, created_at, is_completed, total_questions, score')
      .eq('user_id', manuelId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!latestTest) {
      console.log('⏳ Esperando que empieces un test...')
      return
    }

    // Si es un test nuevo
    if (lastTestId !== latestTest.id) {
      lastTestId = latestTest.id
      lastQuestionCount = 0
      console.log('\n🆕 NUEVO TEST DETECTADO:')
      console.log('   ID:', latestTest.id)
      console.log('   Creado:', new Date(latestTest.created_at).toLocaleTimeString('es-ES'))
      console.log('   Total preguntas:', latestTest.total_questions)
      console.log()
    }

    // Contar preguntas guardadas
    const { count } = await supabase
      .from('test_questions')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', latestTest.id)

    // Si hay nuevas respuestas
    if (count > lastQuestionCount) {
      const newAnswers = count - lastQuestionCount
      console.log(`📝 Pregunta ${count}/${latestTest.total_questions} guardada ${newAnswers > 1 ? `(+${newAnswers})` : ''}`)
      lastQuestionCount = count

      // Verificar duplicados en este test
      const { data: duplicates } = await supabase
        .from('test_questions')
        .select('question_order')
        .eq('test_id', latestTest.id)

      const orders = duplicates.map(d => d.question_order)
      const hasDuplicates = orders.length !== new Set(orders).size

      if (hasDuplicates) {
        console.log('   ⚠️  DUPLICADO DETECTADO!')
        const duplicateOrders = orders.filter((o, i) => orders.indexOf(o) !== i)
        console.log('   Preguntas duplicadas:', [...new Set(duplicateOrders)])
      }
    }

    // Si se completó
    if (latestTest.is_completed && count === latestTest.total_questions) {
      console.log('\n✅ TEST COMPLETADO!')
      console.log('   Score:', latestTest.score, '/', latestTest.total_questions)
      console.log('   Todas las respuestas guardadas correctamente')
      console.log()
      console.log('🔍 Verificación final...')

      // Verificación final de duplicados
      const { data: allQuestions } = await supabase
        .from('test_questions')
        .select('question_order')
        .eq('test_id', latestTest.id)

      const finalOrders = allQuestions.map(q => q.question_order).sort((a, b) => a - b)
      const uniqueOrders = [...new Set(finalOrders)]

      if (finalOrders.length === uniqueOrders.length) {
        console.log('   ✅ Sin duplicados - Sistema funcionando correctamente')
      } else {
        console.log('   ❌ Duplicados encontrados:', finalOrders.length - uniqueOrders.length)
      }

      console.log('\n👋 Test finalizado. Presiona Ctrl+C para salir.')
    }

  }, 2000) // Cada 2 segundos
}

main()
