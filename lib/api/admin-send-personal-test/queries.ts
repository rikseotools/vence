// lib/api/admin-send-personal-test/queries.ts - Queries para envío de notificación personal
import { getDb } from '@/db/client'
import { userProfiles, userNotificationSettings, notificationEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ============================================
// GET ADMIN PUSH SETTINGS (by email)
// ============================================

export async function getAdminPushSettings(email: string) {
  const db = getDb()

  // Find user by email
  const [profile] = await db
    .select({ id: userProfiles.id })
    .from(userProfiles)
    .where(eq(userProfiles.email, email))
    .limit(1)

  if (!profile) return null

  // Get notification settings
  const [settings] = await db
    .select({
      pushEnabled: userNotificationSettings.pushEnabled,
      pushSubscription: userNotificationSettings.pushSubscription,
    })
    .from(userNotificationSettings)
    .where(eq(userNotificationSettings.userId, profile.id))
    .limit(1)

  if (!settings) return null

  return {
    userId: profile.id,
    pushEnabled: settings.pushEnabled,
    pushSubscription: settings.pushSubscription,
  }
}

// ============================================
// LOG PUSH EVENT
// ============================================

export async function logPushEvent(params: {
  userId: string
  notificationType: string
  pushSubscription: unknown
  notificationData: Record<string, unknown>
}) {
  try {
    const db = getDb()
    await db.insert(notificationEvents).values({
      userId: params.userId,
      eventType: 'notification_sent',
      notificationType: params.notificationType || 'test',
      deviceInfo: { source: 'personal_admin_test' },
      browserInfo: { personalTest: true },
      pushSubscription: params.pushSubscription,
      notificationData: {
        ...params.notificationData,
        personalAdminTest: true,
        domain: 'vence.es',
      },
      userAgent: 'personal-admin-test',
      createdAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('⚠️ Error registrando evento (no crítico):', error)
  }
}
