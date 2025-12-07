import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debugTests() {
  const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'

  // 1. Ver TODOS los tests del usuario
  const { data: allTests, error } = await supabase
    .from('tests')
    .select('id, created_at, total_questions, total_correct, title')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)

  console.log('📊 ÚLTIMOS 10 TESTS DEL USUARIO:')
  console.log('='.repeat(60))

  if (error) {
    console.log('ERROR:', error)
    return
  }

  if (allTests) {
    for (const test of allTests) {
      // Para cada test, contar las preguntas reales
      const { data: questions } = await supabase
        .from('test_questions')
        .select('id, is_correct')
        .eq('test_id', test.id)

      const realQuestions = questions?.length || 0
      const realCorrect = questions?.filter(q => q.is_correct).length || 0

      console.log(`\nTest: ${test.id}`)
      console.log(`  Fecha: ${test.created_at}`)
      console.log(`  Título: ${test.title || 'Sin título'}`)
      console.log(`  total_questions (campo): ${test.total_questions}`)
      console.log(`  total_correct (campo): ${test.total_correct || 'NULL'}`)
      console.log(`  PREGUNTAS REALES: ${realQuestions}`)
      console.log(`  CORRECTAS REALES: ${realCorrect}`)

      if (test.total_questions !== realQuestions) {
        console.log(`  ⚠️ DISCREPANCIA: Campo dice ${test.total_questions} pero hay ${realQuestions} preguntas`)
      }
    }
  }
}

debugTests().catch(console.error)