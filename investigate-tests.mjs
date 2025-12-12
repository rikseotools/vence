import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

console.log('🔍 INVESTIGACIÓN PROFUNDA')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

// 1. Ver si hay tests recientes (últimos 5 días)
const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()

console.log('1️⃣ Buscando tests de los últimos 5 días...')
const { data: recentTests, error: recentError } = await supabase
  .from('tests')
  .select('id, title, created_at, is_completed, score, total_questions, test_type')
  .gte('created_at', fiveDaysAgo)
  .order('created_at', { ascending: false })
  .limit(10)

console.log('   Tests encontrados:', recentTests?.length || 0)
if (recentTests && recentTests.length > 0) {
  recentTests.forEach((t, idx) => {
    console.log(`   ${idx + 1}. ${t.title || 'Sin título'}`)
    console.log(`      Fecha: ${new Date(t.created_at).toLocaleString('es-ES')}`)
    console.log(`      Score: ${t.score}/${t.total_questions}`)
    console.log('')
  })
}
console.log('')

// 2. Reconstruir tests desde test_questions (últimas 100 preguntas)
console.log('2️⃣ Reconstruyendo tests desde test_questions...')
const { data: questions } = await supabase
  .from('test_questions')
  .select('test_id, created_at, is_correct')
  .order('created_at', { ascending: false })
  .limit(100)

const testMap = new Map()
questions?.forEach(q => {
  if (!testMap.has(q.test_id)) {
    testMap.set(q.test_id, {
      test_id: q.test_id,
      created_at: q.created_at,
      total: 0,
      correct: 0
    })
  }
  const test = testMap.get(q.test_id)
  test.total++
  if (q.is_correct) test.correct++
})

const reconstructed = Array.from(testMap.values()).sort((a, b) =>
  new Date(b.created_at) - new Date(a.created_at)
)

console.log(`   Tests reconstruidos: ${reconstructed.length}`)
console.log('')
console.log('   Últimos 5 tests (desde preguntas):')
reconstructed.slice(0, 5).forEach((t, idx) => {
  const date = new Date(t.created_at).toLocaleString('es-ES')
  console.log(`   ${idx + 1}. ${date}`)
  console.log(`      Score: ${t.correct}/${t.total}`)
  console.log(`      Test ID: ${t.test_id}`)
  console.log('')
})

// 3. Verificar si esos test_ids existen en tabla tests
console.log('3️⃣ Verificando si los test_ids existen en tabla tests...')
for (let i = 0; i < Math.min(3, reconstructed.length); i++) {
  const testId = reconstructed[i].test_id
  const { data: testData, error } = await supabase
    .from('tests')
    .select('id, title')
    .eq('id', testId)

  console.log(`   Test ${testId.substring(0, 8)}...`)
  console.log(`      ¿Existe en tabla tests? ${testData && testData.length > 0 ? '✅ SÍ' : '❌ NO'}`)
  console.log('')
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
