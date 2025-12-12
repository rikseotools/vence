import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

console.log('🔍 Buscando test 46df5bc6-adea-4ee1-9bf0-8c44705d92a7 de todas las formas posibles...')
console.log('')

// Primero obtener el usuario
const { data: userData } = await supabase.auth.getUser()
const userId = userData?.user?.id

if (!userId) {
  console.log('⚠️ No se pudo obtener user_id, buscando tests sin filtro de usuario')
}

// Buscar en tests
const testsQuery = supabase
  .from('tests')
  .select('id, title, test_type, is_completed, started_at, completed_at, user_id, score')
  .order('started_at', { ascending: false })
  .limit(10)

if (userId) {
  testsQuery.eq('user_id', userId)
}

const { data: allTests, error: allError } = await testsQuery

if (allError) {
  console.error('❌ Error:', allError)
} else {
  console.log(`📋 Últimos 5 tests del usuario:`)
  allTests.forEach(t => {
    console.log(`  - ${t.id}`)
    console.log(`    Title: ${t.title}`)
    console.log(`    Type: ${t.test_type}`)
    console.log(`    Completed: ${t.is_completed}`)
    console.log(`    Score: ${t.score}`)
    console.log(`    Started: ${t.started_at}`)
    console.log(`    Completed At: ${t.completed_at}`)
    console.log('')
  })
}

// Buscar las preguntas para ver qué test_id tienen
const { data: questions } = await supabase
  .from('test_questions')
  .select('test_id, question_order')
  .ilike('test_id', '46df5bc6%')
  .limit(1)

if (questions && questions.length > 0) {
  console.log('✅ Preguntas encontradas con test_id:', questions[0].test_id)

  // Intentar buscar ese test específico
  const { data: specificTest, error: specError } = await supabase
    .from('tests')
    .select('*')
    .eq('id', questions[0].test_id)

  if (specError) {
    console.error('❌ Error buscando test específico:', specError)
  } else if (specificTest.length === 0) {
    console.error('❌ TEST NO EXISTE EN TABLA tests')
    console.log('🚨 PROBLEMA: Las preguntas se guardaron pero el test nunca se creó en la tabla tests')
  } else {
    console.log('✅ Test encontrado:', specificTest[0])
  }
}
