require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const testId = 'f3d74605-6757-43b4-a87d-2aab398d5d38' // Test más reciente de Nila

  console.log('🔍 Investigando test de Nila:', testId, '\n')

  // Info del test
  const { data: test, error: testError } = await supabase
    .from('tests')
    .select('*')
    .eq('id', testId)
    .single()

  if (testError) {
    console.error('❌ Error:', testError)
    return
  }

  console.log('📊 INFO DEL TEST:')
  console.log('   Total preguntas esperadas:', test.total_questions)
  console.log('   Score:', test.score)
  console.log('   is_completed:', test.is_completed)
  console.log('   completed_at:', test.completed_at)
  console.log('   Creado:', new Date(test.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }))
  console.log()

  // Preguntas guardadas
  const { data: questions, error: questionsError } = await supabase
    .from('test_questions')
    .select('question_order, is_correct, created_at')
    .eq('test_id', testId)
    .order('question_order', { ascending: true })

  if (questionsError) {
    console.error('❌ Error:', questionsError)
    return
  }

  console.log('📝 PREGUNTAS GUARDADAS:', questions.length)
  console.log()

  // Ver cuáles faltan
  const savedOrders = questions.map(q => q.question_order)
  const missingOrders = []

  for (let i = 1; i <= test.total_questions; i++) {
    if (!savedOrders.includes(i)) {
      missingOrders.push(i)
    }
  }

  if (missingOrders.length > 0) {
    console.log('❌ PREGUNTAS FALTANTES:', missingOrders.join(', '))
    console.log()
  }

  // Ver las últimas 5 preguntas guardadas
  console.log('📅 ÚLTIMAS 5 PREGUNTAS GUARDADAS:')
  const last5 = questions.slice(-5)
  last5.forEach(q => {
    const time = new Date(q.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })
    console.log(`   Pregunta ${q.question_order} - ${q.is_correct ? '✅' : '❌'} - ${time}`)
  })
  console.log()

  // Tiempo entre última pregunta y ahora
  if (questions.length > 0) {
    const lastQuestion = questions[questions.length - 1]
    const lastTime = new Date(lastQuestion.created_at)
    const now = new Date()
    const diffMinutes = Math.round((now - lastTime) / (1000 * 60))

    console.log('⏱️  TIEMPO DESDE ÚLTIMA PREGUNTA:')
    console.log(`   Última pregunta guardada: ${lastTime.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}`)
    console.log(`   Hace: ${diffMinutes} minutos`)
    console.log()

    console.log('🔍 ANÁLISIS:')
    if (missingOrders.length === 0) {
      console.log('   ✅ Tiene todas las preguntas pero NO está marcado como completado')
      console.log('   🐛 ESTE ES EL BUG que arreglamos hoy')
      console.log('   💡 Necesita corrección manual')
    } else if (questions.length >= test.total_questions - 3) {
      console.log('   ⚠️  Le faltan', missingOrders.length, 'preguntas de', test.total_questions)
      console.log('   🤔 Posibles causas:')
      console.log('      - Usuario cerró el navegador/pestaña')
      console.log('      - Error de red al guardar')
      console.log('      - Crash de la aplicación')
      console.log('      - Bug en el guardado de respuestas')
    } else {
      console.log('   ⏸️  Test claramente abandonado (solo', questions.length, 'de', test.total_questions, ')')
    }
  }
}

main()
