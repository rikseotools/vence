import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testStreakTrigger() {
  console.log('🧪 TEST: VERIFICANDO SI HAY UN TRIGGER ACTIVO\n')
  console.log('='.repeat(60))

  // Usuario de prueba (Manuel)
  const testUserId = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f'

  // 1. Ver racha actual
  const { data: beforeStreak } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', testUserId)
    .single()

  console.log('📊 ANTES del test:')
  console.log(`  - Racha actual: ${beforeStreak?.current_streak || 0}`)
  console.log(`  - Última actividad: ${beforeStreak?.last_activity_date || 'N/A'}`)

  // 2. Insertar un test (esto debería disparar el trigger si existe)
  console.log('\n➡️ Insertando un test nuevo...')

  const { data: newTest, error: testError } = await supabase
    .from('tests')
    .insert({
      user_id: testUserId,
      title: 'Test de prueba para rachas',
      total_questions: 1,
      is_completed: true,
      created_at: new Date().toISOString()
    })
    .select()
    .single()

  if (testError) {
    console.error('Error insertando test:', testError)
    return
  }

  console.log(`✅ Test insertado con ID: ${newTest.id}`)

  // 3. Esperar un momento para que el trigger se ejecute
  console.log('\n⏳ Esperando 2 segundos para que se ejecute el trigger...')
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 4. Ver si la racha cambió
  const { data: afterStreak } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_id', testUserId)
    .single()

  console.log('\n📊 DESPUÉS del test:')
  console.log(`  - Racha actual: ${afterStreak?.current_streak || 0}`)
  console.log(`  - Última actividad: ${afterStreak?.last_activity_date || 'N/A'}`)

  // 5. Análisis
  console.log('\n🔍 ANÁLISIS:')

  if (!beforeStreak && !afterStreak) {
    console.log('❌ No existe registro de rachas para este usuario')
    console.log('   → NO HAY TRIGGER que cree registros automáticamente')
  } else if (beforeStreak && afterStreak) {
    const today = new Date().toISOString().split('T')[0]

    if (beforeStreak.last_activity_date === today) {
      console.log('⚠️ Ya había actividad hoy, no se puede determinar si hay trigger')
    } else if (afterStreak.last_activity_date === today) {
      console.log('✅ La fecha se actualizó a HOY')
      console.log('   → SÍ HAY UN TRIGGER ACTIVO')

      if (afterStreak.current_streak > beforeStreak.current_streak) {
        console.log('   → El trigger INCREMENTÓ la racha')
      } else if (afterStreak.current_streak === 1 && beforeStreak.current_streak > 1) {
        console.log('   → El trigger REINICIÓ la racha a 1')
      }
    } else {
      console.log('❌ La fecha NO se actualizó')
      console.log('   → NO HAY TRIGGER ACTIVO o está deshabilitado')
    }
  }

  // 6. Limpiar test de prueba
  console.log('\n🧹 Limpiando test de prueba...')
  const { error: deleteError } = await supabase
    .from('tests')
    .delete()
    .eq('id', newTest.id)

  if (!deleteError) {
    console.log('✅ Test de prueba eliminado')
  }

  // 7. Conclusión final
  console.log('\n' + '='.repeat(60))
  console.log('💡 CONCLUSIÓN:')
  if (afterStreak?.last_activity_date === new Date().toISOString().split('T')[0]) {
    console.log('✅ HAY UN TRIGGER/FUNCIÓN QUE ACTUALIZA user_streaks')
    console.log('   cuando se inserta en la tabla tests')
  } else {
    console.log('❌ NO SE DETECTÓ ACTUALIZACIÓN AUTOMÁTICA')
    console.log('   Las rachas deben actualizarse de otra forma:')
    console.log('   - Proceso batch/cron externo')
    console.log('   - Actualización manual desde el frontend')
    console.log('   - Vista calculada on-demand')
  }
}

testStreakTrigger().catch(console.error)