// app/api/admin/send-personal-test/route.ts
// API para enviar notificación push personal al admin
import { NextResponse } from 'next/server'
// @ts-expect-error -- web-push has no type declarations
import webpush from 'web-push'
import { getAdminPushSettings, logPushEvent } from '@/lib/api/admin-send-personal-test'
import { sendPersonalTestRequestSchema } from '@/lib/api/admin-send-personal-test/schemas'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = sendPersonalTestRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos: ' + parsed.error.message },
        { status: 400 }
      )
    }

    const { adminEmail, title, body: notifBody, category, data } = parsed.data

    // Solo permitir a manueltrader@gmail.com por seguridad
    if (adminEmail !== 'manueltrader@gmail.com') {
      return NextResponse.json(
        { error: 'Solo permitido para el administrador principal' },
        { status: 403 }
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
      webpush.setVapidDetails(`mailto:${vapidEmail}`, vapidPublicKey, vapidPrivateKey)
    } catch (vapidError) {
      return NextResponse.json(
        { error: 'Error en configuración VAPID: ' + (vapidError as Error).message },
        { status: 500 }
      )
    }

    console.log('🎯 Enviando notificación personal a:', adminEmail)

    const settings = await getAdminPushSettings(adminEmail)

    if (!settings) {
      return NextResponse.json(
        { error: 'Usuario administrador no encontrado o sin configuración de push' },
        { status: 404 }
      )
    }

    if (!settings.pushEnabled || !settings.pushSubscription) {
      return NextResponse.json(
        { error: 'Push notifications no habilitadas para este usuario' },
        { status: 400 }
      )
    }

    // Parsear suscripción
    let subscription: webpush.PushSubscription
    try {
      subscription = JSON.parse(settings.pushSubscription as string)
    } catch {
      return NextResponse.json(
        { error: 'Suscripción push inválida' },
        { status: 400 }
      )
    }

    // Preparar payload
    const notificationPayload = {
      title,
      body: notifBody,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: `personal-admin-test-${Date.now()}`,
      data: {
        category: category || 'admin_test',
        url: 'https://www.vence.es/auxiliar-administrativo-estado?from=push_test',
        timestamp: Date.now(),
        testSentBy: adminEmail,
        domain: 'vence.es',
        ...data,
      },
      actions: [
        { action: 'study', title: '📚 Estudiar', icon: '/icon-study.png' },
        { action: 'dismiss', title: '⏰ Después', icon: '/icon-dismiss.png' },
      ],
      requireInteraction: true,
      silent: false,
    }

    console.log('📤 Enviando push personal a:', (subscription as { endpoint?: string }).endpoint?.substring(0, 50))
    const pushResult = await webpush.sendNotification(
      subscription,
      JSON.stringify(notificationPayload),
      { urgency: 'normal', TTL: 24 * 60 * 60 }
    )

    console.log('✅ Push personal enviado exitosamente:', pushResult.statusCode)

    // Registrar evento en analytics
    await logPushEvent({
      userId: settings.userId,
      notificationType: category || 'admin_test',
      pushSubscription: settings.pushSubscription,
      notificationData: {
        title,
        body: notifBody,
        category: category || 'admin_test',
        testSentBy: adminEmail,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Notificación personal enviada exitosamente a ${adminEmail}`,
      details: {
        pushStatusCode: pushResult.statusCode,
        pushHeaders: pushResult.headers,
        userId: settings.userId,
        title,
        category: category || 'admin_test',
        timestamp: new Date().toISOString(),
        domain: 'vence.es',
      },
    })
  } catch (error) {
    console.error('❌ Error enviando notificación personal:', error)

    if ((error as { statusCode?: number }).statusCode === 410) {
      return NextResponse.json(
        { error: 'Suscripción push expirada. Habilita las notificaciones nuevamente desde tu móvil.' },
        { status: 410 }
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

export const POST = withErrorLogging('/api/admin/send-personal-test', _POST)
