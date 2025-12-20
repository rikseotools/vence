import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { adminEmail } = await request.json()

    // Solo permitir a manueltrader@gmail.com por seguridad
    if (adminEmail !== 'manueltrader@gmail.com') {
      return NextResponse.json(
        { error: 'Solo permitido para el administrador principal' },
        { status: 403 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔧 Configurando usuarios de prueba para testing push...')

    // Usuarios específicos para habilitar como test
    const testUsers = [
      'manueltrader@gmail.com',
      'alvarodelasheras960@gmail.com', 
      'ilovetestpro@gmail.com'
    ]

    const results = []

    for (const email of testUsers) {
      try {
        // Buscar el usuario
        const { data: userProfile, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, email, full_name')
          .eq('email', email)
          .single()

        if (profileError) {
          results.push({ email, status: 'not_found', error: profileError.message })
          continue
        }

        // Crear configuración básica SIN suscripción fake - que aparezca el prompt automático
        const { error: upsertError } = await supabase
          .from('user_notification_settings')
          .upsert({
            user_id: userProfile.id,
            push_enabled: false,
            push_subscription: null,
            preferred_times: ['09:00', '14:00', '20:00'],
            timezone: 'Europe/Madrid',
            frequency: 'smart',
            oposicion_type: 'auxiliar-administrativo',
            motivation_level: 'medium',
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' })

        if (upsertError) {
          results.push({ email, status: 'error', error: upsertError.message })
        } else {
          results.push({ 
            email, 
            status: 'success', 
            user_id: userProfile.id,
            name: userProfile.full_name 
          })
          console.log(`✅ ${email} configurado para testing`)
        }

      } catch (userError) {
        results.push({ email, status: 'error', error: userError.message })
      }
    }

    // Contar usuarios configurados exitosamente
    const successCount = results.filter(r => r.status === 'success').length

    return NextResponse.json({
      success: true,
      message: `Configurados ${successCount} usuarios de prueba para testing push`,
      results
    })

  } catch (error) {
    console.error('❌ Error configurando usuarios de prueba:', error)
    return NextResponse.json(
      { error: 'Error interno: ' + error.message },
      { status: 500 }
    )
  }
}