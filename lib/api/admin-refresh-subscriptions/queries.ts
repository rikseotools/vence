// lib/api/admin-refresh-subscriptions/queries.ts
import { getDb } from '@/db/client'
import { userNotificationSettings, notificationEvents } from '@/db/schema'
import { eq, isNotNull } from 'drizzle-orm'

// ============================================
// OBTENER SUSCRIPCIONES ACTIVAS
// ============================================

export async function getActiveSubscriptions() {
  const db = getDb()

  const subscriptions = await db
    .select({
      userId: userNotificationSettings.userId,
      pushSubscription: userNotificationSettings.pushSubscription
    })
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.pushEnabled, true))

  // Filtrar en JS las que tienen push_subscription no null
  // (isNotNull no se puede combinar con eq en un solo where sin and())
  return subscriptions.filter(s => s.pushSubscription !== null)
}

// ============================================
// MARCAR SUSCRIPCIÓN COMO EXPIRADA
// ============================================

export async function markSubscriptionExpired(
  userId: string,
  statusCode: number
): Promise<void> {
  const db = getDb()

  await db
    .update(userNotificationSettings)
    .set({
      pushEnabled: false,
      pushSubscription: null,
      updatedAt: new Date().toISOString()
    })
    .where(eq(userNotificationSettings.userId!, userId))

  // Registrar evento (no crítico)
  try {
    await db.insert(notificationEvents).values({
      userId,
      eventType: 'subscription_deleted',
      notificationType: 'test',
      deviceInfo: { adminCleanup: true },
      browserInfo: { reason: 'subscription_410_error' },
      notificationData: {
        action: 'admin_cleanup',
        statusCode,
        cleanupTimestamp: new Date().toISOString()
      },
      createdAt: new Date().toISOString()
    })
  } catch (trackingError) {
    console.error('⚠️ Error registrando evento (no crítico):', trackingError)
  }
}
