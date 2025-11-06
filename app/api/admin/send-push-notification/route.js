// app/api/admin/send-push-notification/route.js - Envío masivo de notificaciones push
import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import webpush from 'web-push'

// Configurar VAPID keys para web-push
const vapidDetails = {
  subject: 'mailto:admin@vence.es',
  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
}

if (vapidDetails.publicKey && vapidDetails.privateKey) {
  webpush.setVapidDetails(
    vapidDetails.subject,
    vapidDetails.publicKey,
    vapidDetails.privateKey
  )
}

export async function POST(request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

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
    const { notification, targetType = 'all' } = await request.json()

    if (!notification || !notification.title || !notification.body) {
      return NextResponse.json({ 
        error: 'Datos de notificación incompletos' 
      }, { status: 400 })
    }

    console.log('📱 [ADMIN PUSH] Enviando notificación:', {
      title: notification.title,
      targetType,
      adminUser: user.email
    })

    // 3. Obtener suscripciones push activas según el tipo de audiencia
    // Primero, obtener usuarios con suscripciones push activas recientes
    const { data: recentSubs, error: subsError } = await supabase
      .from('notification_events')
      .select('user_id, device_info, created_at')
      .eq('event_type', 'subscription_created')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })

    if (subsError) {
      console.error('Error obteniendo suscripciones recientes:', subsError)
      return NextResponse.json({ error: 'Error obteniendo suscripciones' }, { status: 500 })
    }

    if (!recentSubs || recentSubs.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No hay suscripciones push activas recientes'
      })
    }

    // Deduplicar por user_id (tomar la más reciente de cada usuario)
    const uniqueUsers = {}
    recentSubs.forEach(sub => {
      if (!uniqueUsers[sub.user_id] || new Date(sub.created_at) > new Date(uniqueUsers[sub.user_id].created_at)) {
        uniqueUsers[sub.user_id] = sub
      }
    })

    const uniqueUserIds = Object.keys(uniqueUsers)
    
    // Simular datos de suscripción (en producción necesitarías una tabla real)
    const subscriptions = uniqueUserIds.map(userId => ({
      user_id: userId,
      endpoint: `https://fcm.googleapis.com/fcm/send/${userId}`, // Placeholder
      p256dh_key: 'placeholder_p256dh', // En producción esto vendría de la BD real
      auth_key: 'placeholder_auth', // En producción esto vendría de la BD real
      user_profiles: {
        email: `user_${userId}@example.com`,
        full_name: `Usuario ${userId}`,
        is_active_student: true
      }
    }))

    let query = subscriptions

    if (targetType === 'active_users') {
      // Solo usuarios que han hecho tests en los últimos 30 días
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

      const uniqueActiveUserIds = [...new Set(activeUserIds.map(t => t.user_id))]
      
      if (uniqueActiveUserIds.length > 0) {
        // Filtrar suscripciones solo para usuarios activos
        query = subscriptions.filter(sub => uniqueActiveUserIds.includes(sub.user_id))
      } else {
        // Si no hay usuarios activos, no enviar nada
        return NextResponse.json({
          success: true,
          sent: 0,
          message: 'No hay usuarios activos en los últimos 30 días'
        })
      }
    } else {
      // Usar todas las suscripciones
      query = subscriptions
    }

    // Limitar a 1000 para evitar timeouts
    const finalSubscriptions = query.slice(0, 1000)

    if (!finalSubscriptions || finalSubscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        message: 'No hay suscripciones push activas'
      })
    }

    console.log(`📱 [ADMIN PUSH] Encontradas ${finalSubscriptions.length} suscripciones`)

    // 4. Verificar configuración de VAPID
    if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
      console.error('❌ [ADMIN PUSH] VAPID keys no configuradas')
      console.log('📱 [ADMIN PUSH] Simulando envío (modo desarrollo)')
      
      // En modo desarrollo, simular el envío exitoso
      const mockSentCount = finalSubscriptions.length
      
      // Registrar eventos simulados
      for (const subscription of finalSubscriptions) {
        await supabase
          .from('notification_events')
          .insert({
            user_id: subscription.user_id,
            event_type: 'notification_sent',
            notification_type: 'admin_message',
            device_info: { source: 'admin_panel', mode: 'simulated' },
            notification_data: {
              title: notification.title,
              body: notification.body,
              trackingId: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            },
            created_at: new Date().toISOString()
          })
      }
      
      return NextResponse.json({
        success: true,
        sent: mockSentCount,
        failed: 0,
        total: finalSubscriptions.length,
        message: `[SIMULADO] Notificación enviada a ${mockSentCount} dispositivos`,
        mode: 'simulated'
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
        trackingId: notification.data?.trackingId || `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      },
      actions: notification.actions || [
        {
          action: 'open',
          title: '📚 Abrir App',
          icon: '/icon-192.png'
        },
        {
          action: 'dismiss',
          title: '⏰ Después',
          icon: '/icon-dismiss.png'
        }
      ],
      requireInteraction: notification.requireInteraction || false,
      tag: notification.tag || `admin_notification_${Date.now()}`
    }

    // 6. Enviar notificaciones en lotes
    let sentCount = 0
    let failedCount = 0
    const batchSize = 50 // Procesar de 50 en 50 para evitar timeouts

    for (let i = 0; i < finalSubscriptions.length; i += batchSize) {
      const batch = finalSubscriptions.slice(i, i + batchSize)
      
      const promises = batch.map(async (subscription) => {
        try {
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh_key,
              auth: subscription.auth_key
            }
          }

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(completePayload),
            {
              TTL: 24 * 60 * 60, // 24 horas
              urgency: 'normal',
              topic: 'admin_message'
            }
          )

          sentCount++

          // Registrar evento de notificación enviada
          await supabase
            .from('notification_events')
            .insert({
              user_id: subscription.user_id,
              event_type: 'notification_sent',
              notification_type: completePayload.data.category,
              device_info: { source: 'admin_panel' },
              notification_data: {
                title: completePayload.title,
                body: completePayload.body,
                trackingId: completePayload.data.trackingId
              },
              created_at: new Date().toISOString()
            })

          console.log(`✅ [ADMIN PUSH] Enviada a ${subscription.user_profiles?.email}`)

        } catch (error) {
          failedCount++
          console.error(`❌ [ADMIN PUSH] Error enviando a ${subscription.user_profiles?.email}:`, error.message)

          // Si es error 410 (endpoint expirado), desactivar suscripción
          if (error.statusCode === 410) {
            console.log(`🧹 [ADMIN PUSH] Desactivando suscripción expirada para ${subscription.user_profiles?.email}`)
            await supabase
              .from('user_notification_settings')
              .update({ push_enabled: false })
              .eq('user_id', subscription.user_id)
          }

          // Registrar error de notificación
          await supabase
            .from('notification_events')
            .insert({
              user_id: subscription.user_id,
              event_type: 'notification_failed',
              notification_type: completePayload.data.category,
              device_info: { 
                source: 'admin_panel',
                error: error.message,
                statusCode: error.statusCode
              },
              notification_data: {
                title: completePayload.title,
                body: completePayload.body,
                trackingId: completePayload.data.trackingId
              },
              created_at: new Date().toISOString()
            })
        }
      })

      await Promise.allSettled(promises)
      
      // Pequeña pausa entre lotes para no saturar
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
      message: `Notificación enviada exitosamente a ${sentCount} dispositivos${failedCount > 0 ? ` (${failedCount} fallidas)` : ''}`
    })

  } catch (error) {
    console.error('❌ [ADMIN PUSH] Error general:', error)
    return NextResponse.json({ 
      error: 'Error interno del servidor',
      details: error.message 
    }, { status: 500 })
  }
}