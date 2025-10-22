import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { userId, userEmail, forcedBy } = await request.json()

    if (!userId || !userEmail) {
      return NextResponse.json(
        { error: 'userId y userEmail son obligatorios' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log(`⚡ Forzando prompt de reactivación para ${userEmail} (ID: ${userId})`)

    // Verificar que el usuario existe
    const { data: userProfile, error: userError } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .eq('id', userId)
      .single()

    if (userError || !userProfile) {
      console.error('❌ Usuario no encontrado:', userError)
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Reiniciar configuración de notificaciones para forzar prompt
    const { error: updateError } = await supabase
      .from('user_notification_settings')
      .upsert({
        user_id: userId,
        push_enabled: false,
        push_subscription: null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (updateError) {
      console.error('❌ Error actualizando configuración:', updateError)
      return NextResponse.json(
        { error: 'Error actualizando configuración de notificaciones' },
        { status: 500 }
      )
    }

    // Registrar evento de admin para tracking
    try {
      await supabase.from('notification_events').insert({
        user_id: userId,
        event_type: 'admin_forced_reactivation_prompt',
        notification_type: 'admin_action',
        device_info: { 
          action: 'force_reactivation_prompt',
          admin_user: forcedBy,
          timestamp: new Date().toISOString()
        },
        browser_info: { 
          forced_by_admin: true,
          admin_email: forcedBy
        },
        notification_data: {
          title: 'Admin Action: Forced Reactivation Prompt',
          body: `Administrator ${forcedBy} forced reactivation prompt for user ${userEmail}`,
          category: 'admin_management',
          admin_action: true
        },
        user_agent: 'admin-force-reactivation',
        created_at: new Date().toISOString()
      })
    } catch (trackingError) {
      console.error('⚠️ Error registrando evento admin (no crítico):', trackingError)
      // No fallar la API por error de tracking
    }

    // También actualizar localStorage del usuario para forzar verificación inmediata
    // (esto se detectará la próxima vez que el usuario use la app)
    
    console.log(`✅ Prompt de reactivación forzado exitosamente para ${userEmail}`)

    return NextResponse.json({
      success: true,
      message: `Prompt de reactivación forzado exitosamente para ${userEmail}`,
      details: {
        userId: userId,
        userEmail: userEmail,
        action: 'Configuration reset to force reactivation prompt',
        forcedBy: forcedBy,
        timestamp: new Date().toISOString(),
        nextStep: 'User will see activation prompt on next app visit'
      }
    })

  } catch (error) {
    console.error('❌ Error forzando prompt de reactivación:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}