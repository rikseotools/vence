import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

export async function POST(request) {
  try {
    const { adminEmail, title, body, category, data } = await request.json()

    // Solo permitir a manueltrader@gmail.com por seguridad
    if (adminEmail !== 'manueltrader@gmail.com') {
      return NextResponse.json(
        { error: 'Solo permitido para el administrador principal' },
        { status: 403 }
      )
    }

    if (!title || !body) {
      return NextResponse.json(
        { error: 'title y body son obligatorios' },
        { status: 400 }
      )
    }

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

    console.log('🎯 Enviando notificación personal a:', adminEmail)

    // Buscar el usuario admin por email
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', adminEmail)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json(
        { error: 'Usuario administrador no encontrado' },
        { status: 404 }
      )
    }

    // Obtener configuración de notificaciones del admin
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_notification_settings')
      .select('push_enabled, push_subscription')
      .eq('user_id', userProfile.id)
      .single()

    if (settingsError || !userSettings) {
      return NextResponse.json(
        { error: 'Configuración de push no encontrada. Habilita las notificaciones primero.' },
        { status: 404 }
      )
    }

    if (!userSettings.push_enabled || !userSettings.push_subscription) {
      return NextResponse.json(
        { error: 'Push notifications no habilitadas para este usuario' },
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

    // Preparar payload de la notificación con configuración específica de Vence
    const notificationPayload = {
      title,
      body,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `personal-admin-test-${Date.now()}`,
      data: {
        category: category || 'admin_test',
        url: 'https://www.vence.es/auxiliar-administrativo-estado?from=push_test',
        timestamp: Date.now(),
        testSentBy: adminEmail,
        domain: 'vence.es',
        ...data
      },
      actions: [
        {
          action: 'study',
          title: '📚 Ir a Vence',
          icon: '/icon-study.png'
        },
        {
          action: 'dismiss',
          title: '❌ Cerrar',
          icon: '/icon-dismiss.png'
        }
      ],
      requireInteraction: true, // Requiere interacción para testing
      silent: false
    }

    // Enviar notificación push
    console.log('📤 Enviando push personal a:', subscription.endpoint?.substring(0, 50))
    const pushResult = await webpush.sendNotification(
      subscription,
      JSON.stringify(notificationPayload),
      {
        urgency: 'normal',
        TTL: 24 * 60 * 60 // 24 horas
      }
    )

    console.log('✅ Push personal enviado exitosamente:', pushResult.statusCode)

    // Registrar evento en analytics
    try {
      await supabase.from('notification_events').insert({
        user_id: userProfile.id,
        event_type: 'notification_sent_personal_admin_test',
        notification_type: category || 'admin_test',
        device_info: { source: 'personal_admin_test' },
        browser_info: { personalTest: true },
        push_subscription: userSettings.push_subscription,
        notification_data: {
          title,
          body,
          category: category || 'admin_test',
          testSentBy: adminEmail,
          personalAdminTest: true,
          domain: 'vence.es'
        },
        user_agent: 'personal-admin-test',
        created_at: new Date().toISOString()
      })
    } catch (trackingError) {
      console.error('⚠️ Error registrando evento (no crítico):', trackingError)
    }

    return NextResponse.json({
      success: true,
      message: `Notificación personal enviada exitosamente a ${adminEmail}`,
      details: {
        pushStatusCode: pushResult.statusCode,
        pushHeaders: pushResult.headers,
        userId: userProfile.id,
        title,
        category: category || 'admin_test',
        timestamp: new Date().toISOString(),
        domain: 'vence.es'
      }
    })

  } catch (error) {
    console.error('❌ Error enviando notificación personal:', error)

    if (error.statusCode === 410) {
      return NextResponse.json(
        { error: 'Suscripción push expirada. Habilita las notificaciones nuevamente desde tu móvil.' },
        { status: 410 }
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