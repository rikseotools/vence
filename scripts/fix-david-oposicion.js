// Script para corregir el target_oposicion de David
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixDavidOposicion() {
  try {
    const davidId = 'b375abac-c2a8-41c3-9c2b-bf937c9a5619'
    const correctValue = 'auxiliar_administrativo_estado'

    console.log('🔧 Corrigiendo target_oposicion de David...\n')

    // Ver valor actual
    const { data: before, error: beforeError } = await supabase
      .from('user_profiles')
      .select('id, full_name, target_oposicion')
      .eq('id', davidId)
      .single()

    if (beforeError) {
      console.error('❌ Error obteniendo perfil:', beforeError)
      return
    }

    console.log('📋 ANTES DE LA CORRECCIÓN:')
    console.log(`  Nombre: ${before.full_name}`)
    console.log(`  target_oposicion: ${before.target_oposicion}`)
    console.log(`  Es UUID: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(before.target_oposicion) ? 'SÍ ❌' : 'NO ✅'}\n`)

    // Actualizar
    const { data: updated, error: updateError } = await supabase
      .from('user_profiles')
      .update({ target_oposicion: correctValue })
      .eq('id', davidId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error actualizando:', updateError)
      return
    }

    console.log('✅ CORRECCIÓN EXITOSA!')
    console.log(`  Nombre: ${updated.full_name}`)
    console.log(`  target_oposicion: ${updated.target_oposicion}`)
    console.log(`  Es UUID: ${/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(updated.target_oposicion) ? 'SÍ ❌' : 'NO ✅'}`)

    console.log('\n✨ Ahora el perfil de David debería mostrar correctamente:')
    console.log('   - Temas dominados')
    console.log('   - Proyección de preparación')
    console.log('   - Fecha estimada para dominar el temario')

  } catch (err) {
    console.error('❌ Error inesperado:', err)
  }
}

fixDavidOposicion()
