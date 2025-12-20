import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const testId = '8c76aae2-009b-4400-b5e9-4dcf1d0cdc75'

console.log('🧪 SIMULANDO GUARDADO EN SEGUNDO PLANO')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

// 1. Ver estado actual
const { data: currentQuestions } = await supabase
  .from('test_questions')
  .select('question_order, question_text')
  .eq('test_id', testId)
  .order('question_order')

console.log('📊 ESTADO ACTUAL:')
console.log('   Preguntas guardadas:', currentQuestions?.length || 0)
console.log('   Question_orders:', currentQuestions?.map(q => q.question_order).join(', '))
console.log('')

// 2. Identificar preguntas faltantes (deberían ser 4, 5, 6)
const savedOrders = new Set(currentQuestions?.map(q => q.question_order) || [])
const expectedOrders = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const missingOrders = expectedOrders.filter(order => !savedOrders.has(order))

console.log('🔍 PREGUNTAS FALTANTES:')
console.log('   Orders faltantes:', missingOrders.join(', '))
console.log('')

if (missingOrders.length === 0) {
  console.log('✅ No faltan preguntas - ejecuta primero: node test-background-save.mjs')
  process.exit(0)
}

// 3. SIMULAR el guardado en segundo plano
console.log('💾 ═══════════════════════════════════════════')
console.log('💾 SIMULANDO GUARDADO EN SEGUNDO PLANO')
console.log('💾 ═══════════════════════════════════════════')
console.log('')

let savedCount = 0
let errorCount = 0

for (const order of missingOrders) {
  console.log(`───────────────────────────────────────────`)
  console.log(`💾 Guardando pregunta ${order} (faltante)`)

  // Datos simulados de la pregunta
  const mockQuestionData = {
    test_id: testId,
    question_order: order,
    question_text: `Pregunta simulada ${order} (recuperada por background save)`,
    user_answer: 'A',
    correct_answer: 'B',
    is_correct: false,
    time_spent_seconds: 30,
    confidence_level: 'sure'
  }

  try {
    const { data, error } = await supabase
      .from('test_questions')
      .insert(mockQuestionData)
      .select()

    if (error) {
      errorCount++
      console.error(`   ❌ Error guardando:`, error.message)
    } else {
      savedCount++
      console.log(`   ✅ Guardada exitosamente`)
    }
  } catch (err) {
    errorCount++
    console.error(`   ❌ Excepción:`, err.message)
  }
}

console.log('')
console.log('💾 ═══════════════════════════════════════════')
console.log(`✅ GUARDADO EN SEGUNDO PLANO COMPLETADO`)
console.log(`   - Guardadas: ${savedCount}`)
console.log(`   - Errores: ${errorCount}`)
console.log('💾 ═══════════════════════════════════════════')
console.log('')

// 4. Verificar resultado final
const { data: finalQuestions } = await supabase
  .from('test_questions')
  .select('question_order')
  .eq('test_id', testId)
  .order('question_order')

console.log('📊 RESULTADO FINAL:')
console.log('   Preguntas guardadas:', finalQuestions?.length || 0)
console.log('   Question_orders:', finalQuestions?.map(q => q.question_order).join(', '))
console.log('')

if (finalQuestions?.length === 10) {
  console.log('✅ ÉXITO: Todas las preguntas recuperadas!')
} else {
  console.log('⚠️  Aún faltan preguntas:', 10 - (finalQuestions?.length || 0))
}

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
