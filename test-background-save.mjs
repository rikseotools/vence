import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const userId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f' // Tu usuario

console.log('🧪 TEST: Simulando preguntas faltantes en test')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

// 1. Usar el test que acabamos de crear
const testId = '8c76aae2-009b-4400-b5e9-4dcf1d0cdc75'

const latestTest = {
  id: testId,
  title: 'Test de prueba',
  total_questions: 10
}

console.log('✅ Test encontrado:', latestTest.id)
console.log('   Total preguntas esperadas:', latestTest.total_questions)
console.log('')

// 2. Ver cuántas preguntas tiene guardadas
const { data: savedQuestions } = await supabase
  .from('test_questions')
  .select('question_order')
  .eq('test_id', latestTest.id)
  .order('question_order')

console.log('📊 Preguntas guardadas:', savedQuestions?.length || 0)
console.log('   Question_orders:', savedQuestions?.map(q => q.question_order).join(', '))
console.log('')

// 3. SIMULAR FALLO: Borrar algunas preguntas (las del medio)
const questionsToDelete = savedQuestions?.filter(q =>
  q.question_order >= 4 && q.question_order <= 6
) || []

console.log('🗑️  SIMULANDO FALLO: Borrando preguntas 4, 5, 6...')
for (const q of questionsToDelete) {
  const { error } = await supabase
    .from('test_questions')
    .delete()
    .eq('test_id', latestTest.id)
    .eq('question_order', q.question_order)

  if (error) {
    console.error(`   ❌ Error borrando pregunta ${q.question_order}:`, error.message)
  } else {
    console.log(`   ✅ Pregunta ${q.question_order} borrada`)
  }
}

console.log('')

// 4. Verificar estado actual
const { data: afterDelete } = await supabase
  .from('test_questions')
  .select('question_order')
  .eq('test_id', latestTest.id)
  .order('question_order')

console.log('📊 DESPUÉS DE BORRAR:')
console.log('   Preguntas guardadas:', afterDelete?.length || 0)
console.log('   Total esperadas:', latestTest.total_questions)
console.log('   Faltan:', latestTest.total_questions - (afterDelete?.length || 0))
console.log('   Question_orders:', afterDelete?.map(q => q.question_order).join(', '))
console.log('')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ SIMULACIÓN COMPLETADA')
console.log('')
console.log('🎯 AHORA:')
console.log('1. Recarga la página del test en el navegador')
console.log('2. Responde de nuevo la última pregunta')
console.log('3. Busca en la consola:')
console.log('   "📊 Preguntas en BD: X/10"')
console.log('   "⚠️  Faltan N preguntas por guardar"')
console.log('   "💾 GUARDADO EN SEGUNDO PLANO INICIADO"')
console.log('   "✅ GUARDADO EN SEGUNDO PLANO COMPLETADO"')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
