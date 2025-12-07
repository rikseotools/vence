// Script para arreglar el onboarding de Nila
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function fixNilaOnboarding() {
  const userId = 'c16c186a-4e70-4b1e-a3bd-c107e13670dd'

  console.log('🔧 Arreglando onboarding de Nila...\n')

  // Actualizar el campo faltante - Usando formato correcto (número entero)
  const { error } = await supabase
    .from('user_profiles')
    .update({
      daily_study_hours: 2 // Valor por defecto: 2 horas
    })
    .eq('id', userId)

  if (error) {
    console.error('❌ Error actualizando:', error)
    return
  }

  console.log('✅ Campo daily_study_hours actualizado a 2 horas')

  // Verificar que ahora está completo
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('target_oposicion, age, gender, daily_study_hours, ciudad, onboarding_completed_at')
    .eq('id', userId)
    .single()

  const allFieldsPresent = profile.target_oposicion &&
                           profile.age &&
                           profile.gender &&
                           profile.daily_study_hours &&
                           profile.ciudad &&
                           profile.onboarding_completed_at

  if (allFieldsPresent) {
    console.log('\n✅ ÉXITO: Todos los campos están completos')
    console.log('   El modal ya NO debería aparecer más')
    console.log('\n📝 Campos verificados:')
    Object.entries(profile).forEach(([key, value]) => {
      console.log(`   ✅ ${key}: ${value}`)
    })
  } else {
    console.log('\n⚠️  Aún hay campos faltantes')
  }
}

fixNilaOnboarding()