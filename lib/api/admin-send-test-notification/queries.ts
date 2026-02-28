// lib/api/admin-send-test-notification/queries.ts - Queries para envío de notificación de prueba
import { getDb } from '@/db/client'
import { userNotificationSettings, notificationEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ============================================
// GET USER PUSH SETTINGS
// ============================================

export async function getUserPushSettings(userId: string) {
  const db = getDb()
  const [settings] = await db
    .select({
      pushEnabled: userNotificationSettings.pushEnabled,
      pushSubscription: userNotificationSettings.pushSubscription,
    })
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, userId))
    .limit(1)

  return settings ?? null
}

// ============================================
// LOG TEST PUSH EVENT
// ============================================

export async function logTestPushEvent(params: {
  userId: string
  category: string | undefined
  pushSubscription: unknown
  notificationData: Record<string, unknown>
}) {
  try {
    const db = getDb()
    await db.insert(notificationEvents).values({
      userId: params.userId,
      eventType: 'notification_sent',
      notificationType: params.category || 'test',
      deviceInfo: { source: 'admin_test_panel' },
      browserInfo: { adminTest: true },
      pushSubscription: params.pushSubscription,
      notificationData: {
        ...params.notificationData,
        adminTestPanel: true,
      },
      userAgent: 'admin-test-panel',
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('⚠️ Error registrando evento (no crítico):', error)
  }
}
