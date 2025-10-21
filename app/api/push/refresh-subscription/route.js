import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const { userId, newSubscription } = await request.json()

    if (!userId || !newSubscription) {
      return NextResponse.json(
        { error: 'userId y newSubscription son obligatorios' },
        { status: 400 }
      )
    }

    // Crear cliente Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    console.log('🔄 Renovando suscripción push para usuario:', userId)

    // Actualizar la suscripción en la base de datos
    const { error } = await supabase
      .from('user_notification_settings')
      .update({
        push_subscription: JSON.stringify(newSubscription),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      console.error('❌ Error actualizando suscripción:', error)
      return NextResponse.json(
        { error: 'Error actualizando suscripción en base de datos' },
        { status: 500 }
      )
    }

    // Registrar evento de renovación
    try {
      await supabase.from('notification_events').insert({
        user_id: userId,
        event_type: 'subscription_renewed',
        notification_type: 'system',
        device_info: { renewed: true },
        browser_info: { automatic: true },
        push_subscription: JSON.stringify(newSubscription),
        notification_data: {
          action: 'subscription_renewal',
          reason: 'expired_subscription_auto_refresh'
        },
        user_agent: request.headers.get('user-agent'),
        created_at: new Date().toISOString()
      })
    } catch (trackingError) {
      console.error('⚠️ Error registrando renovación (no crítico):', trackingError)
    }

    console.log('✅ Suscripción renovada exitosamente')
    
    return NextResponse.json({
      success: true,
      message: 'Suscripción renovada exitosamente'
    })

  } catch (error) {
    console.error('❌ Error renovando suscripción:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}