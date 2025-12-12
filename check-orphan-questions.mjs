import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Obtener algunos test_ids de test_questions
const { data: questions } = await supabase
  .from('test_questions')
  .select('test_id, created_at')
  .order('created_at', { ascending: false })
  .limit(5)

console.log('🔍 Verificando si estos test_ids existen en tabla tests:')
console.log('')

for (const q of questions || []) {
  const { data: tests, error } = await supabase
    .from('tests')
    .select('id, title, test_type')
    .eq('id', q.test_id)

  console.log(`Test ID: ${q.test_id}`)
  console.log(`  Created at: ${q.created_at}`)

  if (error) {
    console.log(`  ❌ Error buscando: ${error.message}`)
  } else if (!tests || tests.length === 0) {
    console.log(`  ❌ NO EXISTE en tabla tests (pregunta huérfana)`)
  } else {
    console.log(`  ✅ Existe: ${tests[0].title}`)
  }
  console.log('')
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('CONCLUSIÓN:')
console.log('Si todas las preguntas son huérfanas, significa que:')
console.log('1. Los tests se creaban pero luego se borraban')
console.log('2. O nunca se guardaron por RLS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
