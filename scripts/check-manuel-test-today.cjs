require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  console.log('🔍 Buscando tests de HOYÇ de Manuel...\n')

  // Buscar usuario Manuel
  const { data: users } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .ilike('email', '%laoposicioninfinita%')
    .limit(1)
    .single()

  if (!users) {
    console.error('❌ Usuario no encontrado')
    return
  }

  const userId = users.id
  console.log('👤 Usuario:', users.full_name, '-', users.email)
  console.log('🆔 ID:', userId)
  console.log()

  // Calcular inicio del día en Madrid
  const nowMadrid = new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' })
  const madridDate = new Date(nowMadrid)
  const startOfDayMadrid = new Date(madridDate)
  startOfDayMadrid.setHours(0, 0, 0, 0)

  console.log('📅 Buscando desde:', startOfDayMadrid.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }))
  console.log()

  // Tests de hoy
  const { data: todayTests } = await supabase
    .from('tests')
    .select('id, created_at, is_completed, total_questions, score')
    .eq('user_id', userId)
    .gte('created_at', startOfDayMadrid.toISOString())
    .order('created_at', { ascending: false })

  console.log('📊 TESTS DE HOY:', todayTests.length)
  console.log()

  if (todayTests.length === 0) {
    console.log('❌ No hay tests de hoy')
    return
  }

  for (const test of todayTests) {
    const created = new Date(test.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })

    console.log('📝 Test', test.id.substring(0, 8) + '...')
    console.log('   Creado:', created)
    console.log('   Total preguntas:', test.total_questions)
    console.log('   is_completed:', test.is_completed)
    console.log('   Score:', test.score || 0)

    // Contar preguntas guardadas
    const { data: questions } = await supabase
      .from('test_questions')
      .select('question_order')
      .eq('test_id', test.id)
      .order('question_order', { ascending: true })

    const orders = questions.map(q => q.question_order).sort((a, b) => a - b)
    const uniqueOrders = [...new Set(orders)]

    console.log('   Preguntas guardadas:', questions.length, '/', test.total_questions)

    if (orders.length !== uniqueOrders.length) {
      console.log('   ❌ DUPLICADOS:', orders.length - uniqueOrders.length)
    } else {
      console.log('   ✅ Sin duplicados')
    }

    const expected = Array.from({ length: test.total_questions }, (_, i) => i + 1)
    const missing = expected.filter(o => !orders.includes(o))

    if (missing.length > 0) {
      console.log('   ⚠️  Faltantes:', missing.join(', '))
    } else {
      console.log('   ✅ Todas presentes')
    }

    console.log()
  }
}

main()
