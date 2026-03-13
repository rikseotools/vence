// app/api/push/mark-disabled/route.ts - Marcar push como deshabilitado
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { userNotificationSettings, notificationEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
const markDisabledSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(1),
  timestamp: z.string().optional(),
})

async function _POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = markDisabledSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'userId y reason son obligatorios' },
        { status: 400 }
      )
    }

    const { userId, reason, timestamp } = parsed.data
    const db = getDb()

    console.log(`🚫 Marcando push como deshabilitado para usuario ${userId}. Razón: ${reason}`)

    // Actualizar configuración de notificaciones
    const updateResult = await db
      .update(userNotificationSettings)
      .set({
        pushEnabled: false,
        pushSubscription: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userNotificationSettings.userId, userId))

    if (!updateResult) {
      console.error('❌ Error actualizando configuración')
      return NextResponse.json(
        { error: 'Error actualizando configuración de notificaciones' },
        { status: 500 }
      )
    }

    // Registrar evento de desactivación para analytics
    // Fix: 'push_subscription_disabled' no es un valor válido del constraint DB
    // Se mapea a 'subscription_deleted' (valor válido, semánticamente correcto)
    try {
      await db.insert(notificationEvents).values({
        userId,
        eventType: 'subscription_deleted',
        notificationType: 'study_reminder',
        deviceInfo: {
          reason,
          auto_detected: true,
          timestamp,
        },
        browserInfo: {
          userAgent: 'auto-detection-system',
        },
        notificationData: {
          title: 'Push Subscription Disabled',
          body: `Automatically detected and disabled. Reason: ${reason}`,
          category: 'system_cleanup',
        },
        userAgent: 'push-manager-auto-detection',
        createdAt: new Date().toISOString(),
      })
    } catch (trackingError) {
      console.error('⚠️ Error registrando evento de desactivación (no crítico):', trackingError)
    }

    console.log('✅ Push marcado como deshabilitado exitosamente')

    return NextResponse.json({
      success: true,
      message: 'Push notifications marcadas como deshabilitadas',
      reason,
      timestamp: timestamp ?? new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Error en mark-disabled:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export const POST = withErrorLogging('/api/push/mark-disabled', _POST)
