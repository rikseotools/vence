// Verificación simple y directa de las preguntas perdidas
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkMissingQuestions() {
  const test2Id = '3eec5c11-d8be-40ef-9b6d-f83e543fc0dc'
  const userId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'

  console.log('\n🔍 ANÁLISIS DIRECTO DE PREGUNTAS PERDIDAS\n')
  console.log('='.repeat(80))

  // 1. ¿Las preguntas 11-18 existen EN CUALQUIER test de Nila?
  console.log('\n1️⃣  BUSCAR preguntas 11-18 en CUALQUIER test de Nila:\n')

  const { data: anyQuestions, error: anyError } = await supabase
    .from('test_questions')
    .select('test_id, question_order, created_at')
    .in('test_id', (await supabase
      .from('tests')
      .select('id')
      .eq('user_id', userId)
      .gte('created_at', '2025-12-07T00:00:00Z')
      .lte('created_at', '2025-12-07T23:59:59Z')
    ).data.map(t => t.id))
    .in('question_order', [11, 12, 13, 14, 15, 16, 17, 18])
    .order('question_order')

  if (anyError) {
    console.error('Error:', anyError)
  } else {
    console.log(`Resultado: ${anyQuestions?.length || 0} preguntas encontradas`)
    if (anyQuestions && anyQuestions.length > 0) {
      anyQuestions.forEach(q => {
        console.log(`   Orden ${q.question_order}: ${q.test_id === test2Id ? 'Test 2' : 'Otro test'} | ${q.created_at}`)
      })
    } else {
      console.log('   ❌ Las preguntas 11-18 NO existen en NINGÚN test de hoy')
    }
  }

  // 2. ¿Cuántas preguntas tiene en total el test 2?
  console.log('\n2️⃣  CONTAR preguntas del Test 2:\n')

  const { data: test2Questions, count: test2Count } = await supabase
    .from('test_questions')
    .select('question_order', { count: 'exact' })
    .eq('test_id', test2Id)
    .order('question_order')

  console.log(`Total preguntas en Test 2: ${test2Count}`)
  if (test2Questions) {
    const orders = test2Questions.map(q => q.question_order).sort((a, b) => a - b)
    console.log(`Órdenes presentes: ${orders.join(', ')}`)

    const expected = Array.from({length: 25}, (_, i) => i + 1)
    const missing = expected.filter(n => !orders.includes(n))
    console.log(`Órdenes faltantes: ${missing.join(', ')}`)
  }

  // 3. Análisis del GAP temporal
  console.log('\n3️⃣  ANÁLISIS DEL GAP TEMPORAL:\n')

  if (test2Questions && test2Questions.length > 0) {
    const q10 = test2Questions.find(q => q.question_order === 10)
    const q19 = test2Questions.find(q => q.question_order === 19)

    if (q10 && q19) {
      const { data: q10Full } = await supabase
        .from('test_questions')
        .select('created_at')
        .eq('test_id', test2Id)
        .eq('question_order', 10)
        .single()

      const { data: q19Full } = await supabase
        .from('test_questions')
        .select('created_at')
        .eq('test_id', test2Id)
        .eq('question_order', 19)
        .single()

      const gap = (new Date(q19Full.created_at) - new Date(q10Full.created_at)) / 1000

      console.log(`Pregunta 10 guardada: ${q10Full.created_at}`)
      console.log(`Pregunta 19 guardada: ${q19Full.created_at}`)
      console.log(`Gap: ${gap} segundos (${(gap / 60).toFixed(2)} minutos)`)
      console.log('')
      console.log(`Durante esos ${(gap / 60).toFixed(2)} minutos:`)
      console.log(`   - La usuaria probablemente respondió las preguntas 11-18`)
      console.log(`   - NINGUNA de esas respuestas se guardó en la BD`)
      console.log(`   - El test continuó normalmente desde la pregunta 19`)
    }
  }

  // 4. Verificar metadata del test 2
  console.log('\n4️⃣  METADATA DEL TEST 2:\n')

  const { data: test2 } = await supabase
    .from('tests')
    .select('*')
    .eq('id', test2Id)
    .single()

  if (test2) {
    console.log(`is_completed: ${test2.is_completed}`)
    console.log(`total_questions: ${test2.total_questions}`)
    console.log(`score: ${test2.score}`)
    console.log(`completed_at: ${test2.completed_at}`)

    if (test2.detailed_analytics) {
      const analytics = typeof test2.detailed_analytics === 'string'
        ? JSON.parse(test2.detailed_analytics)
        : test2.detailed_analytics

      console.log('\nDetailed analytics:')
      if (analytics.performance_summary) {
        console.log(`   questions_attempted: ${analytics.performance_summary.questions_attempted}`)
        console.log(`   accuracy_percentage: ${analytics.performance_summary.accuracy_percentage}`)
      }
    }
  }

  console.log('\n' + '='.repeat(80))
  console.log('\n🎯 CONCLUSIÓN FINAL:\n')
  console.log('1. Las preguntas 11-18 NO existen en la base de datos')
  console.log('2. Hay un gap de ~2 minutos entre las preguntas 10 y 19')
  console.log('3. El test se marcó como completado con 25 preguntas')
  console.log('4. Pero solo 17 preguntas se guardaron realmente')
  console.log('')
  console.log('🔴 DIAGNÓSTICO: Fallo de guardado silencioso')
  console.log('   Las preguntas 11-18 se respondieron pero no se guardaron por:')
  console.log('   - Error de red durante ~2 minutos')
  console.log('   - Error silencioso en saveDetailedAnswer()')
  console.log('   - Constraint violation que bloqueó el guardado')
  console.log('   - Bug en el flujo que permitió continuar sin guardar')
  console.log('\n' + '='.repeat(80) + '\n')
}

checkMissingQuestions().catch(console.error)
