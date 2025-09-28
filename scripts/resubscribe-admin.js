// Script para re-suscribir al usuario admin de emails
import { createClient } from '@supabase/supabase-js'

// Configurar Supabase (usa las variables de entorno)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function resubscribeAdmin() {
  try {
    console.log('🔍 Buscando registro de preferencias del admin...')
    
    // Buscar el registro actual
    const { data: currentPrefs, error: selectError } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256')
      .single()
    
    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError
    }

    if (currentPrefs) {
      console.log('📋 Registro actual encontrado:', {
        user_id: currentPrefs.user_id,
        unsubscribed_all: currentPrefs.unsubscribed_all,
        unsubscribed_motivation: currentPrefs.unsubscribed_motivation,
        unsubscribed_achievement: currentPrefs.unsubscribed_achievement,
        updated_at: currentPrefs.updated_at
      })

      // Actualizar el registro para marcarlo como suscrito
      const { data: updateData, error: updateError } = await supabase
        .from('email_preferences')
        .update({
          unsubscribed_all: false,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256')
        .select()

      if (updateError) {
        throw updateError
      }

      console.log('✅ Usuario admin re-suscrito exitosamente!')
      console.log('📋 Registro actualizado:', updateData[0])
      
    } else {
      console.log('📭 No se encontró registro de email_preferences para el admin')
      console.log('✅ El usuario admin ya está suscrito por defecto (no tiene registro de unsubscribe)')
    }

    // Verificar el estado actual
    console.log('\n🔍 Verificando estado final...')
    const { data: finalCheck } = await supabase
      .from('email_preferences')
      .select('*')
      .eq('user_id', 'b9ebbad0-cb6d-4dc3-87fc-a32a31611256')

    if (finalCheck && finalCheck.length > 0) {
      const prefs = finalCheck[0]
      console.log(`📊 Estado final: ${prefs.unsubscribed_all ? '❌ No suscrito' : '✅ Suscrito'}`)
    } else {
      console.log('📊 Estado final: ✅ Suscrito (sin registro de preferencias)')
    }

  } catch (error) {
    console.error('❌ Error re-suscribiendo admin:', error)
    process.exit(1)
  }
}

// Ejecutar el script
resubscribeAdmin().then(() => {
  console.log('\n🎉 Script completado. Recarga la página de email analytics para ver los cambios.')
  process.exit(0)
})