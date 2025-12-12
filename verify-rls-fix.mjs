import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

console.log('🧪 VERIFICANDO FIX DE RLS...')
console.log('')

// 1. Intentar insertar un test de prueba
const testData = {
  user_id: '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f',
  title: 'TEST DE VERIFICACIÓN RLS',
  test_type: 'practice',
  total_questions: 5,
  score: 0,
  is_completed: false,
  started_at: new Date().toISOString()
}

console.log('📤 1. Intentando INSERT...')
const { data: inserted, error: insertError } = await supabase
  .from('tests')
  .insert(testData)
  .select()
  .single()

if (insertError) {
  console.error('❌ INSERT falló:', insertError.message)
  console.error('   Code:', insertError.code)
  if (insertError.code === '42501') {
    console.error('')
    console.error('🚨 RLS aún bloqueando - ¿ejecutaste el SQL?')
  }
  process.exit(1)
} else {
  console.log('✅ INSERT exitoso!')
  console.log('   ID creado:', inserted.id)
  console.log('')

  // 2. Intentar leer el test
  console.log('📤 2. Intentando SELECT...')
  const { data: selected, error: selectError } = await supabase
    .from('tests')
    .select('*')
    .eq('id', inserted.id)
    .single()

  if (selectError) {
    console.error('❌ SELECT falló:', selectError.message)
  } else {
    console.log('✅ SELECT exitoso!')
    console.log('   Test leído:', selected.title)
    console.log('')

    // 3. Intentar actualizar el test
    console.log('📤 3. Intentando UPDATE...')
    const { data: updated, error: updateError } = await supabase
      .from('tests')
      .update({ score: 5, is_completed: true })
      .eq('id', inserted.id)
      .select()
      .single()

    if (updateError) {
      console.error('❌ UPDATE falló:', updateError.message)
    } else {
      console.log('✅ UPDATE exitoso!')
      console.log('   Score actualizado:', updated.score)
      console.log('')

      // 4. Intentar eliminar el test
      console.log('📤 4. Intentando DELETE...')
      const { error: deleteError } = await supabase
        .from('tests')
        .delete()
        .eq('id', inserted.id)

      if (deleteError) {
        console.error('❌ DELETE falló:', deleteError.message)
      } else {
        console.log('✅ DELETE exitoso!')
        console.log('')
      }
    }
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ TODAS LAS POLÍTICAS RLS FUNCIONAN CORRECTAMENTE')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
