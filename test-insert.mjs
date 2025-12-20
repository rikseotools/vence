import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

console.log('🧪 TEST: Intentando insertar en tabla tests con ANON_KEY...')
console.log('')

const testData = {
  user_id: '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f',
  title: 'TEST MANUAL',
  test_type: 'practice',
  total_questions: 5,
  score: 0,
  is_completed: false,
  started_at: new Date().toISOString()
}

console.log('📤 Datos a insertar:', testData)
console.log('')

const { data, error } = await supabase
  .from('tests')
  .insert(testData)
  .select()
  .single()

console.log('📥 Respuesta:')
console.log('  - data:', data)
console.log('  - error:', error)
console.log('')

if (error) {
  console.error('❌ ERROR DETALLADO:')
  console.error('  - Code:', error.code)
  console.error('  - Message:', error.message)
  console.error('  - Details:', error.details)
  console.error('  - Hint:', error.hint)

  if (error.code === '42501') {
    console.error('')
    console.error('🚨 ESTE ES UN ERROR DE PERMISOS RLS')
    console.error('   La tabla tests tiene RLS habilitado pero no hay política de INSERT')
  }
} else if (data) {
  console.log('✅ INSERT exitoso, ID:', data.id)

  // Verificar que se guardó
  console.log('')
  console.log('🔍 Verificando que se guardó...')
  const { data: check, error: checkError } = await supabase
    .from('tests')
    .select('id, title')
    .eq('id', data.id)
    .single()

  if (checkError) {
    console.error('❌ No se puede leer el test recién creado:', checkError.message)
  } else {
    console.log('✅ Test verificado:', check)
  }
}
