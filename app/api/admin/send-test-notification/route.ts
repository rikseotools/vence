// app/api/admin/send-test-notification/route.ts
// API para enviar notificación de prueba a un usuario específico
import { NextResponse } from 'next/server'
// @ts-expect-error -- web-push has no type declarations
import webpush from 'web-push'
import { getUserPushSettings, logTestPushEvent } from '@/lib/api/admin-send-test-notification'
import { sendTestNotificationRequestSchema } from '@/lib/api/admin-send-test-notification/schemas'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = sendTestNotificationRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'userId, title y body son obligatorios' },
        { status: 400 }
      )
    }

    const { userId, title, body: notifBody, category, data } = parsed.data

    // Configurar VAPID dentro de la función para evitar errores en build time
    const vapidEmail = process.env.VAPID_EMAIL
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

    if (!vapidEmail || !vapidPublicKey || !vapidPrivateKey) {
      console.error('❌ VAPID keys no configuradas correctamente')
      return NextResponse.json(
        { error: 'Configuración VAPID incompleta' },
        { status: 500 }
      )
    }

    try {
      webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)
    } catch (vapidError) {
      console.error('❌ Error configurando VAPID:', (vapidError as Error).message)
      return NextResponse.json(
        { error: 'Error en configuración VAPID: ' + (vapidError as Error).message },
        { status: 500 }
      )
    }

    console.log('🔔 Enviando notificación de prueba...', { userId, title, category })

    const userSettings = await getUserPushSettings(userId)

    if (!userSettings) {
      return NextResponse.json(
        { error: 'Usuario no encontrado o sin configuración de push' },
        { status: 404 }
      )
    }

    if (!userSettings.pushEnabled || !userSettings.pushSubscription) {
      return NextResponse.json(
        { error: 'Usuario no tiene notificaciones push habilitadas' },
        { status: 400 }
      )
    }

    // Parsear suscripción
    let subscription: webpush.PushSubscription
    try {
      subscription = JSON.parse(userSettings.pushSubscription as string)
    } catch {
      return NextResponse.json(
        { error: 'Suscripción push inválida' },
        { status: 400 }
      )
    }

    // Preparar payload de la notificación
    const notificationPayload = {
      title,
      body: notifBody,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `admin-test-${Date.now()}`,
      data: {
        category,
        url: '/test/aleatorio?from=admin_test',
        timestamp: Date.now(),
        testSentBy: 'admin_test_panel',
        domain: 'Vence.es',
        ...data,
      },
      actions: [
        { action: 'study', title: '📚 Estudiar', icon: '/icon-study.png' },
        { action: 'later', title: '⏰ Después', icon: '/icon-later.png' },
      ],
      requireInteraction: false,
      silent: false,
    }

    // Verificar si es una suscripción de prueba (fake)
    const isFakeSubscription = (subscription as { endpoint?: string }).endpoint?.includes('FAKE_ENDPOINT_FOR_TESTING')

    let pushResult: { statusCode: number; headers: Record<string, string>; body?: string }

    if (isFakeSubscription) {
      console.log('🧪 Simulando envío a suscripción de prueba:', (subscription as { endpoint?: string }).endpoint)
      pushResult = {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: 'Simulated success for test endpoint',
      }
      console.log('✅ Push simulado exitosamente para endpoint de prueba')
    } else {
      console.log('📤 Enviando push real a:', (subscription as { endpoint?: string }).endpoint)
      pushResult = await webpush.sendNotification(
        subscription,
        JSON.stringify(notificationPayload),
        { urgency: 'normal', TTL: 24 * 60 * 60 }
      )
      console.log('✅ Push real enviado exitosamente:', pushResult.statusCode)
    }

    // Registrar evento en analytics
    await logTestPushEvent({
      userId,
      category,
      pushSubscription: userSettings.pushSubscription,
      notificationData: {
        title,
        body: notifBody,
        category: category ?? 'test',
        testSentBy: data?.testSentBy || 'admin',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Notificación enviada exitosamente',
      details: {
        pushStatusCode: pushResult.statusCode,
        pushHeaders: pushResult.headers,
        userId,
        title,
        category,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('❌ Error enviando notificación de prueba:', error)

    if ((error as { statusCode?: number }).statusCode === 410) {
      return NextResponse.json(
        { error: 'Suscripción push expirada o inválida' },
        { status: 410 }
      )
    }

    if ((error as { statusCode?: number }).statusCode === 413) {
      return NextResponse.json(
        { error: 'Payload de notificación demasiado grande' },
        { status: 413 }
      )
    }

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: (error as Error).message,
        statusCode: (error as { statusCode?: number }).statusCode,
      },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/admin/send-test-notification', _POST)
