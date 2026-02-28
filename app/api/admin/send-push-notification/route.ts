// app/api/admin/send-push-notification/route.ts
// API para envío masivo de notificaciones push
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
// @ts-expect-error -- web-push has no type declarations
import webpush from 'web-push'
import { getDb } from '@/db/client'
import { notificationEvents, userNotificationSettings } from '@/db/schema'
import { eq, gte, sql } from 'drizzle-orm'

// Configurar VAPID keys para web-push
const vapidDetails = {
  subject: 'mailto:admin@vence.es',
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
}

if (vapidDetails.publicKey && vapidDetails.privateKey) {
  webpush.setVapidDetails(
    vapidDetails.subject,
    vapidDetails.publicKey,
    vapidDetails.privateKey
  )
}

// Helper to get service client for auth check (needs supabase.auth.getUser + RPC)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: Request) {
  try {
    const supabase = getServiceClient()

    // 1. Verificar autenticación y permisos de admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc('is_current_user_admin')
    if (adminError || !isAdmin) {
      console.error('Error verificando admin o usuario no es admin:', adminError)
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // 2. Obtener datos del request
    const { notification, targetType = 'all' }: {
      notification: { title: string; body: string; icon?: string; badge?: string; data?: Record<string, unknown>; actions?: unknown[]; requireInteraction?: boolean; tag?: string }
      targetType?: string
    } = await request.json()

    if (!notification || !notification.title || !notification.body) {
      return NextResponse.json({
        error: 'Datos de notificación incompletos',
      }, { status: 400 })
    }

    console.log('📱 [ADMIN PUSH] Enviando notificación:', {
      title: notification.title,
      targetType,
      adminUser: user.email,
    })

    // 3. Obtener suscripciones push activas según el tipo de audiencia
    const db = getDb()
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

    const recentSubs = await db
      .select({
        userId: notificationEvents.userId,
        deviceInfo: notificationEvents.deviceInfo,
        createdAt: notificationEvents.createdAt,
      })
      .from(notificationEvents)
      .where(
        sql`${notificationEvents.eventType} = 'subscription_created' AND ${notificationEvents.createdAt} >= ${ninetyDaysAgo}`
      )
      .orderBy(sql`${notificationEvents.createdAt} DESC`)

    if (!recentSubs || recentSubs.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No hay suscripciones push activas recientes',
      })
    }

    // Deduplicar por user_id (tomar la más reciente de cada usuario)
    const uniqueUsers: Record<string, typeof recentSubs[number]> = {}
    recentSubs.forEach(sub => {
      const userId = sub.userId ?? ''
      if (!uniqueUsers[userId] || new Date(sub.createdAt!) > new Date(uniqueUsers[userId].createdAt!)) {
        uniqueUsers[userId] = sub
      }
    })

    const uniqueUserIds = Object.keys(uniqueUsers)

    // Simular datos de suscripción (en producción necesitarías una tabla real)
    let subscriptions = uniqueUserIds.map(userId => ({
      user_id: userId,
      endpoint: `https://fcm.googleapis.com/fcm/send/${userId}`,
      p256dh_key: 'placeholder_p256dh',
      auth_key: 'placeholder_auth',
      user_profiles: {
        email: `user_${userId}@example.com`,
        full_name: `Usuario ${userId}`,
        is_active_student: true,
      },
    }))

    if (targetType === 'active_users') {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: activeUserIds, error: activeError } = await supabase
        .from('tests')
        .select('user_id')
        .gte('created_at', thirtyDaysAgo)
        .eq('is_completed', true)

      if (activeError) {
        console.error('Error obteniendo usuarios activos:', activeError)
        return NextResponse.json({ error: 'Error obteniendo usuarios activos' }, { status: 500 })
      }

      const uniqueActiveUserIds = [...new Set(activeUserIds?.map(t => t.user_id) ?? [])]

      if (uniqueActiveUserIds.length > 0) {
        subscriptions = subscriptions.filter(sub => uniqueActiveUserIds.includes(sub.user_id))
      } else {
        return NextResponse.json({
          success: true,
          sent: 0,
          message: 'No hay usuarios activos en los últimos 30 días',
        })
      }
    }

    const finalSubscriptions = subscriptions.slice(0, 1000)

    if (finalSubscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No hay suscripciones push activas',
      })
    }

    console.log(`📱 [ADMIN PUSH] Encontradas ${finalSubscriptions.length} suscripciones`)

    // 4. Verificar configuración de VAPID
    if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
      console.error('❌ [ADMIN PUSH] VAPID keys no configuradas')
      console.log('📱 [ADMIN PUSH] Simulando envío (modo desarrollo)')

      const mockSentCount = finalSubscriptions.length

      for (const subscription of finalSubscriptions) {
        await db.insert(notificationEvents).values({
          userId: subscription.user_id,
          eventType: 'notification_sent',
          notificationType: 'admin_message',
          deviceInfo: { source: 'admin_panel', mode: 'simulated' },
          notificationData: {
            title: notification.title,
            body: notification.body,
            trackingId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          },
          createdAt: new Date().toISOString(),
        })
      }

      return NextResponse.json({
        success: true,
        sent: mockSentCount,
        failed: 0,
        total: finalSubscriptions.length,
        message: `[SIMULADO] Notificación enviada a ${mockSentCount} dispositivos`,
        mode: 'simulated',
      })
    }

    // 5. Preparar payload completo de notificación
    const completePayload = {
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icon-192.png',
      badge: notification.badge || '/badge-72.png',
      data: {
        url: notification.data?.url || '/',
        category: notification.data?.category || 'admin_message',
        timestamp: Date.now(),
        trackingId: notification.data?.trackingId || `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
      actions: notification.actions || [
        { action: 'open', title: '📚 Abrir App', icon: '/icon-192.png' },
        { action: 'dismiss', title: '⏰ Después', icon: '/icon-dismiss.png' },
      ],
      requireInteraction: notification.requireInteraction || false,
      tag: notification.tag || `admin_notification_${Date.now()}`,
    }

    // 6. Enviar notificaciones en lotes
    let sentCount = 0
    let failedCount = 0
    const batchSize = 50

    for (let i = 0; i < finalSubscriptions.length; i += batchSize) {
      const batch = finalSubscriptions.slice(i, i + batchSize)

      const promises = batch.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh_key,
              auth: subscription.auth_key,
            },
          }

          await webpush.sendNotification(
            pushSubscription as webpush.PushSubscription,
            JSON.stringify(completePayload),
            { TTL: 24 * 60 * 60, urgency: 'normal', topic: 'admin_message' }
          )

          sentCount++

          await db.insert(notificationEvents).values({
            userId: subscription.user_id,
            eventType: 'notification_sent',
            notificationType: (completePayload.data.category as string) ?? 'admin_message',
            deviceInfo: { source: 'admin_panel' },
            notificationData: {
              title: completePayload.title,
              body: completePayload.body,
              trackingId: completePayload.data.trackingId,
            },
            createdAt: new Date().toISOString(),
          })

          console.log(`✅ [ADMIN PUSH] Enviada a ${subscription.user_profiles?.email}`)
        } catch (error) {
          failedCount++
          console.error(`❌ [ADMIN PUSH] Error enviando a ${subscription.user_profiles?.email}:`, (error as Error).message)

          if ((error as { statusCode?: number }).statusCode === 410) {
            console.log(`🧹 [ADMIN PUSH] Desactivando suscripción expirada para ${subscription.user_profiles?.email}`)
            await db
              .update(userNotificationSettings)
              .set({ pushEnabled: false })
              .where(eq(userNotificationSettings.userId, subscription.user_id))
          }

          await db.insert(notificationEvents).values({
            userId: subscription.user_id,
            eventType: 'notification_failed',
            notificationType: (completePayload.data.category as string) ?? 'admin_message',
            deviceInfo: {
              source: 'admin_panel',
              error: (error as Error).message,
              statusCode: (error as { statusCode?: number }).statusCode,
            },
            notificationData: {
              title: completePayload.title,
              body: completePayload.body,
              trackingId: completePayload.data.trackingId,
            },
            createdAt: new Date().toISOString(),
          })
        }
      })

      await Promise.allSettled(promises)

      if (i + batchSize < finalSubscriptions.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    console.log(`📱 [ADMIN PUSH] Completado: ${sentCount} enviadas, ${failedCount} fallidas`)

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      total: finalSubscriptions.length,
      message: `Notificación enviada exitosamente a ${sentCount} dispositivos${failedCount > 0 ? ` (${failedCount} fallidas)` : ''}`,
    })
  } catch (error) {
    console.error('❌ [ADMIN PUSH] Error general:', error)
    return NextResponse.json({
      error: 'Error interno del servidor',
      details: (error as Error).message,
    }, { status: 500 })
  }
}
