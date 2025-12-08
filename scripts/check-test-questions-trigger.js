import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkTestQuestionsTrigger() {
  console.log('🔍 VERIFICANDO SI HAY TRIGGER EN test_questions\n')
  console.log('='.repeat(60))

  // Usuario de prueba (Manuel)
  const testUserId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'

  // 1. Ver racha actual
  const { data: beforeStreak } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', testUserId)
    .single()

  console.log('📊 ANTES de insertar en test_questions:')
  console.log(`  - Racha actual: ${beforeStreak?.current_streak || 0}`)
  console.log(`  - Última actividad: ${beforeStreak?.last_activity_date || 'N/A'}`)

  // 2. Primero crear un test
  const { data: testRecord, error: testError } = await supabase
    .from('tests')
    .insert({
      user_id: testUserId,
      title: 'Test para verificar trigger',
      total_questions: 1,
      is_completed: false
    })
    .select()
    .single()

  if (testError) {
    console.error('Error creando test:', testError)
    return
  }

  console.log(`\n✅ Test creado: ${testRecord.id}`)

  // 3. Insertar una pregunta en test_questions
  console.log('\n➡️ Insertando pregunta en test_questions...')

  const { data: question, error: questionError } = await supabase
    .from('test_questions')
    .insert({
      test_id: testRecord.id,
      question_text: 'Pregunta de prueba para trigger',
      selected_answer: 0,
      question_order: 1,
      is_correct: true,
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (questionError) {
    console.error('Error insertando pregunta:', questionError)

    // Limpiar test
    await supabase.from('tests').delete().eq('id', testRecord.id)
    return
  }

  console.log(`✅ Pregunta insertada: ${question.id}`)

  // 4. Esperar para que el trigger se ejecute
  console.log('\n⏳ Esperando 3 segundos para que se ejecute el trigger...')
  await new Promise(resolve => setTimeout(resolve, 3000))

  // 5. Ver si la racha cambió
  const { data: afterStreak } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', testUserId)
    .single()

  console.log('\n📊 DESPUÉS de insertar en test_questions:')
  console.log(`  - Racha actual: ${afterStreak?.current_streak || 0}`)
  console.log(`  - Última actividad: ${afterStreak?.last_activity_date || 'N/A'}`)

  // 6. Análisis
  console.log('\n🔍 ANÁLISIS:')
  const today = new Date().toISOString().split('T')[0]

  if (afterStreak?.last_activity_date === today && beforeStreak?.last_activity_date !== today) {
    console.log('✅ LA FECHA SE ACTUALIZÓ A HOY')
    console.log('   → HAY UN TRIGGER EN test_questions QUE ACTUALIZA user_streaks')

    if (afterStreak.current_streak !== beforeStreak.current_streak) {
      console.log(`   → La racha cambió de ${beforeStreak.current_streak} a ${afterStreak.current_streak}`)
    }
  } else {
    console.log('❌ NO SE DETECTÓ ACTUALIZACIÓN')
    console.log('   → NO HAY TRIGGER EN test_questions')
  }

  // 7. Limpiar datos de prueba
  console.log('\n🧹 Limpiando datos de prueba...')

  await supabase.from('test_questions').delete().eq('test_id', testRecord.id)
  await supabase.from('tests').delete().eq('id', testRecord.id)

  console.log('✅ Limpieza completa')

  // 8. Conclusión
  console.log('\n' + '='.repeat(60))
  console.log('💡 CONCLUSIÓN FINAL:')

  if (afterStreak?.last_activity_date === today && beforeStreak?.last_activity_date !== today) {
    console.log('✅ SÍ HAY UN SISTEMA DE ACTUALIZACIÓN DE RACHAS')
    console.log('   Se ejecuta al insertar en test_questions')
    console.log('\n🐛 PROBLEMA IDENTIFICADO:')
    console.log('   El trigger existe pero tiene un límite de 60 días')
    console.log('   Por eso las rachas no pasan de 60')
  } else {
    console.log('❌ NO HAY ACTUALIZACIÓN AUTOMÁTICA DE RACHAS')
    console.log('   Las rachas están congeladas en valores antiguos')
  }
}

checkTestQuestionsTrigger().catch(console.error)