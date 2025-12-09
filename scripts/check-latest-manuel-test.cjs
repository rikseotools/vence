require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Verificando último test de Manuel...\n')

  // Buscar usuario Manuel
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .ilike('full_name', '%manuel%')
    .limit(1)
    .single()

  if (!users) {
    console.error('❌ Usuario no encontrado')
    return
  }

  const userId = users.id
  console.log('👤 Usuario:', users.full_name, '-', userId)
  console.log()

  // Test MÁS reciente
  const { data: latestTest } = await supabase
    .from('tests')
    .select('id, created_at, is_completed, total_questions, score')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!latestTest) {
    console.error('❌ No hay tests')
    return
  }

  const created = new Date(latestTest.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })

  console.log('📊 ÚLTIMO TEST:')
  console.log('   ID:', latestTest.id)
  console.log('   Creado:', created)
  console.log('   Total preguntas:', latestTest.total_questions)
  console.log('   is_completed:', latestTest.is_completed)
  console.log('   Score:', latestTest.score || 0)
  console.log()

  // Contar preguntas guardadas
  const { data: questions } = await supabase
    .from('test_questions')
    .select('question_order')
    .eq('test_id', latestTest.id)
    .order('question_order', { ascending: true })

  console.log('📝 PREGUNTAS GUARDADAS:', questions.length, '/', latestTest.total_questions)

  if (questions.length > 0) {
    const orders = questions.map(q => q.question_order).sort((a, b) => a - b)
    console.log('   Órdenes:', orders.join(', '))

    // Verificar duplicados
    const uniqueOrders = [...new Set(orders)]
    if (orders.length !== uniqueOrders.length) {
      console.log('   ❌ DUPLICADOS DETECTADOS!')
      const duplicates = orders.filter((o, i) => orders.indexOf(o) !== i)
      console.log('   Preguntas duplicadas:', [...new Set(duplicates)])
    } else {
      console.log('   ✅ Sin duplicados')
    }

    // Verificar si faltan preguntas
    const expected = Array.from({ length: latestTest.total_questions }, (_, i) => i + 1)
    const missing = expected.filter(o => !orders.includes(o))

    if (missing.length > 0) {
      console.log('   ⚠️  Preguntas faltantes:', missing.join(', '))
    } else {
      console.log('   ✅ Todas las preguntas presentes')
    }
  }

  console.log()
  console.log('🎯 RESULTADO:')
  if (questions.length === latestTest.total_questions && latestTest.is_completed) {
    console.log('   ✅ TEST COMPLETADO CORRECTAMENTE')
    console.log('   ✅ Sistema de guardado funcionando bien')
  } else if (questions.length === latestTest.total_questions && !latestTest.is_completed) {
    console.log('   ⚠️  Tiene todas las preguntas pero no está marcado como completado')
  } else {
    console.log('   ❌ Test incompleto -', questions.length, 'de', latestTest.total_questions, 'guardadas')
  }
}

main()
