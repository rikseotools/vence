import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export async function POST(request) {
  try {
    console.log('🔄 Iniciando renovación forzada de suscripciones...')

    // Configurar VAPID
    const vapidEmail = process.env.VAPID_EMAIL
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

    if (!vapidEmail || !vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json(
        { error: 'Configuración VAPID incompleta' },
        { status: 500 }
      )
    }

    try {
      webpush.setVapidDetails(
        `mailto:${vapidEmail}`,
        vapidPublicKey,
        vapidPrivateKey
      )
    } catch (vapidError) {
      return NextResponse.json(
        { error: 'Error en configuración VAPID: ' + vapidError.message },
        { status: 500 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Obtener todas las suscripciones activas
    const { data: activeSubscriptions, error } = await supabase
      .from('user_notification_settings')
      .select('user_id, push_subscription')
      .eq('push_enabled', true)
      .not('push_subscription', 'is', null)

    if (error) {
      console.error('❌ Error obteniendo suscripciones:', error)
      return NextResponse.json(
        { error: 'Error obteniendo suscripciones' },
        { status: 500 }
      )
    }

    console.log(`📊 Verificando ${activeSubscriptions?.length || 0} suscripciones...`)

    const results = {
      total: activeSubscriptions?.length || 0,
      valid: 0,
      expired: 0,
      renewed: 0,
      errors: []
    }

    if (!activeSubscriptions || activeSubscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay suscripciones para verificar',
        results
      })
    }

    // Verificar cada suscripción enviando una notificación de test
    for (const userSetting of activeSubscriptions) {
      try {
        console.log(`🔍 Verificando usuario: ${userSetting.user_id}`)
        
        const subscription = JSON.parse(userSetting.push_subscription)
        
        // Intentar enviar una notificación silenciosa de verificación (solo para admins en testing)
        const testPayload = {
          title: 'Test de verificación',
          body: 'Verificando validez de suscripción',
          silent: true,
          tag: 'subscription-check',
          requireInteraction: false,
          data: { 
            type: 'subscription_check',
            timestamp: Date.now(),
            adminTesting: true
          }
        }

        const pushResult = await webpush.sendNotification(
          subscription,
          JSON.stringify(testPayload),
          {
            urgency: 'low',
            TTL: 60 // 1 minuto
          }
        )

        if (pushResult.statusCode === 200 || pushResult.statusCode === 201) {
          console.log(`✅ Suscripción válida para ${userSetting.user_id}`)
          results.valid++
        }

      } catch (pushError) {
        console.log(`❌ Error en suscripción ${userSetting.user_id}:`, pushError.statusCode)
        
        if (pushError.statusCode === 410) {
          // Suscripción expirada - marcar como expirada en BD
          results.expired++
          
          try {
            await supabase
              .from('user_notification_settings')
              .update({
                push_enabled: false,
                push_subscription: null,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', userSetting.user_id)

            // Registrar evento
            await supabase.from('notification_events').insert({
              user_id: userSetting.user_id,
              event_type: 'subscription_expired_admin_cleanup',
              notification_type: 'system',
              device_info: { adminCleanup: true },
              browser_info: { reason: 'subscription_410_error' },
              notification_data: {
                action: 'admin_cleanup',
                statusCode: pushError.statusCode,
                cleanupTimestamp: new Date().toISOString()
              },
              created_at: new Date().toISOString()
            })

            results.renewed++
            console.log(`🔄 Suscripción expirada marcada para renovación: ${userSetting.user_id}`)
            
          } catch (updateError) {
            console.error(`❌ Error actualizando BD para ${userSetting.user_id}:`, updateError)
            results.errors.push({
              user_id: userSetting.user_id,
              error: 'Error actualizando BD: ' + updateError.message
            })
          }
        } else {
          results.errors.push({
            user_id: userSetting.user_id,
            error: `Push error ${pushError.statusCode}: ${pushError.message}`
          })
        }
      }
    }

    console.log('📊 Resultados de limpieza:', results)

    return NextResponse.json({
      success: true,
      message: `Verificación completada. ${results.valid} válidas, ${results.expired} expiradas, ${results.renewed} renovadas.`,
      results
    })

  } catch (error) {
    console.error('❌ Error en renovación forzada:', error)
    return NextResponse.json(
      { error: 'Error interno: ' + error.message },
      { status: 500 }
    )
  }
}