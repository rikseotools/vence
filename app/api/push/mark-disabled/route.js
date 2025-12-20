import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { userId, reason, timestamp } = await request.json()

    if (!userId || !reason) {
      return NextResponse.json(
        { error: 'userId y reason son obligatorios' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log(`🚫 Marcando push como deshabilitado para usuario ${userId}. Razón: ${reason}`)

    // Actualizar configuración de notificaciones
    const { error: updateError } = await supabase
      .from('user_notification_settings')
      .update({
        push_enabled: false,
        push_subscription: null,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('❌ Error actualizando configuración:', updateError)
      return NextResponse.json(
        { error: 'Error actualizando configuración de notificaciones' },
        { status: 500 }
      )
    }

    // Registrar evento de desactivación para analytics
    try {
      await supabase.from('notification_events').insert({
        user_id: userId,
        event_type: 'push_subscription_disabled',
        notification_type: 'system',
        device_info: { 
          reason: reason,
          auto_detected: true,
          timestamp: timestamp 
        },
        browser_info: { 
          userAgent: 'auto-detection-system' 
        },
        notification_data: {
          title: 'Push Subscription Disabled',
          body: `Automatically detected and disabled. Reason: ${reason}`,
          category: 'system_cleanup'
        },
        user_agent: 'push-manager-auto-detection',
        created_at: new Date().toISOString()
      })
    } catch (trackingError) {
      console.error('⚠️ Error registrando evento de desactivación (no crítico):', trackingError)
      // No fallar la API por error de tracking
    }

    console.log('✅ Push marcado como deshabilitado exitosamente')

    return NextResponse.json({
      success: true,
      message: 'Push notifications marcadas como deshabilitadas',
      reason: reason,
      timestamp: timestamp || new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error en mark-disabled:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}