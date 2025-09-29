// scripts/create-test-feedback.js - Crear feedback de prueba para testear notificaciones
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function createTestFeedback() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    console.log('🔔 Creando feedback de prueba...')

    // Crear feedback pendiente con campos requeridos
    const { data, error } = await supabase
      .from('user_feedback')
      .insert([
        {
          type: 'suggestion',
          message: 'PRUEBA: Esta es una prueba de feedback para verificar notificaciones admin - debe parpadear',
          url: '/admin/dashboard',
          status: 'pending'
        },
        {
          type: 'bug', 
          message: 'PRUEBA: Segundo feedback de prueba para testing - debe parpadear también',
          url: '/admin/dashboard',
          status: 'pending'
        }
      ])
      .select()

    if (error) {
      console.error('❌ Error creando feedback:', error)
      return
    }

    console.log('✅ Feedback de prueba creado:', data?.length || 0, 'registros')

    // Verificar conteo
    const { count, error: countError } = await supabase
      .from('user_feedback')
      .select('*', { count: 'exact', head: true })
      .or('is_read.is.false,status.eq.pending')

    if (countError) {
      console.error('❌ Error contando feedback:', countError)
    } else {
      console.log('🔢 Total feedback pendiente:', count)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

createTestFeedback()