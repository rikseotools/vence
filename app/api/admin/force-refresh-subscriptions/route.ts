// app/api/admin/force-refresh-subscriptions/route.ts
import { NextResponse } from 'next/server'
// @ts-expect-error -- web-push has no type declarations
import webpush from 'web-push'
import { getActiveSubscriptions, markSubscriptionExpired } from '@/lib/api/admin-refresh-subscriptions'
import type { RefreshResults } from '@/lib/api/admin-refresh-subscriptions'

export async function POST() {
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
        { error: 'Error en configuración VAPID: ' + (vapidError instanceof Error ? vapidError.message : 'Unknown') },
        { status: 500 }
      )
    }

    // Obtener suscripciones activas desde DB
    const activeSubscriptions = await getActiveSubscriptions()

    console.log(`📊 Verificando ${activeSubscriptions.length} suscripciones...`)

    const results: RefreshResults = {
      total: activeSubscriptions.length,
      valid: 0,
      expired: 0,
      renewed: 0,
      errors: []
    }

    if (activeSubscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay suscripciones para verificar',
        results
      })
    }

    // Verificar cada suscripción enviando una notificación de test
    for (const userSetting of activeSubscriptions) {
      try {
        console.log(`🔍 Verificando usuario: ${userSetting.userId}`)

        const subscription = typeof userSetting.pushSubscription === 'string'
          ? JSON.parse(userSetting.pushSubscription)
          : userSetting.pushSubscription

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
          { urgency: 'low', TTL: 60 }
        )

        if (pushResult.statusCode === 200 || pushResult.statusCode === 201) {
          console.log(`✅ Suscripción válida para ${userSetting.userId}`)
          results.valid++
        }

      } catch (pushError: any) {
        console.log(`❌ Error en suscripción ${userSetting.userId}:`, pushError.statusCode)

        if (pushError.statusCode === 410) {
          results.expired++

          try {
            await markSubscriptionExpired(userSetting.userId!, pushError.statusCode)
            results.renewed++
            console.log(`🔄 Suscripción expirada marcada para renovación: ${userSetting.userId}`)
          } catch (updateError) {
            console.error(`❌ Error actualizando BD para ${userSetting.userId}:`, updateError)
            results.errors.push({
              user_id: userSetting.userId!,
              error: 'Error actualizando BD: ' + (updateError instanceof Error ? updateError.message : 'Unknown')
            })
          }
        } else {
          results.errors.push({
            user_id: userSetting.userId!,
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
      { error: 'Error interno: ' + (error instanceof Error ? error.message : 'Unknown') },
      { status: 500 }
    )
  }
}
