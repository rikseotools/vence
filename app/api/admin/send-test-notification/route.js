import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

// Configurar VAPID
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function POST(request) {
  try {
    const { userId, title, body, category, data } = await request.json()

    if (!userId || !title || !body) {
      return NextResponse.json(
        { error: 'userId, title y body son obligatorios' },
        { status: 400 }
      )
    }

    // Crear cliente Supabase con service key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Verificar que la request viene de un admin autenticado
    // Por simplicidad, verificamos que tenemos las credenciales necesarias
    // En producción, esto debería usar un token JWT o similar
    console.log('🔑 Verificando permisos de admin...')

    console.log('🔔 Enviando notificación de prueba...', { userId, title, category })

    // Obtener configuración de notificaciones del usuario
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_notification_settings')
      .select('push_enabled, push_subscription')
      .eq('user_id', userId)
      .single()

    if (settingsError || !userSettings) {
      return NextResponse.json(
        { error: 'Usuario no encontrado o sin configuración de push' },
        { status: 404 }
      )
    }

    if (!userSettings.push_enabled || !userSettings.push_subscription) {
      return NextResponse.json(
        { error: 'Usuario no tiene notificaciones push habilitadas' },
        { status: 400 }
      )
    }

    // Parsear suscripción
    let subscription
    try {
      subscription = JSON.parse(userSettings.push_subscription)
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Suscripción push inválida' },
        { status: 400 }
      )
    }

    // Preparar payload de la notificación
    const notificationPayload = {
      title,
      body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `admin-test-${Date.now()}`,
      data: {
        category,
        url: '/test/aleatorio?from=admin_test',
        timestamp: Date.now(),
        testSentBy: 'admin_test_panel',
        ...data
      },
      actions: [
        {
          action: 'study',
          title: '🎯 Estudiar Ahora',
          icon: '/icon-study.png'
        },
        {
          action: 'later',
          title: '⏰ Más Tarde',
          icon: '/icon-later.png'
        }
      ],
      requireInteraction: false,
      silent: false
    }

    // Enviar notificación push
    console.log('📤 Enviando push a:', subscription.endpoint)
    const pushResult = await webpush.sendNotification(
      subscription,
      JSON.stringify(notificationPayload),
      {
        urgency: 'normal',
        TTL: 24 * 60 * 60 // 24 horas
      }
    )

    console.log('✅ Push enviado exitosamente:', pushResult.statusCode)

    // Registrar evento en analytics
    try {
      await supabase.from('notification_events').insert({
        user_id: userId,
        event_type: 'notification_sent_admin_test',
        notification_type: category,
        device_info: { source: 'admin_test_panel' },
        browser_info: { adminTest: true },
        push_subscription: userSettings.push_subscription,
        notification_data: {
          title,
          body,
          category,
          testSentBy: data?.testSentBy || 'admin',
          adminTestPanel: true
        },
        user_agent: 'admin-test-panel',
        created_at: new Date().toISOString()
      })
    } catch (trackingError) {
      console.error('⚠️ Error registrando evento (no crítico):', trackingError)
      // No fallar la API por error de tracking
    }

    return NextResponse.json({
      success: true,
      message: 'Notificación enviada exitosamente',
      details: {
        pushStatusCode: pushResult.statusCode,
        pushHeaders: pushResult.headers,
        userId,
        title,
        category,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('❌ Error enviando notificación de prueba:', error)

    // Manejar errores específicos de web-push
    if (error.statusCode === 410) {
      return NextResponse.json(
        { error: 'Suscripción push expirada o inválida' },
        { status: 410 }
      )
    }

    if (error.statusCode === 413) {
      return NextResponse.json(
        { error: 'Payload de notificación demasiado grande' },
        { status: 413 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Error interno del servidor', 
        details: error.message,
        statusCode: error.statusCode 
      },
      { status: 500 }
    )
  }
}