// lib/api/admin-force-reactivation/queries.ts
import { getDb } from '@/db/client'
import { userProfiles, userNotificationSettings, notificationEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { ForceReactivationResponse } from './schemas'

// ============================================
// FORZAR PROMPT DE REACTIVACIÓN
// ============================================

export async function forceReactivationPrompt(
  userId: string,
  userEmail: string,
  forcedBy?: string
): Promise<ForceReactivationResponse> {
  const db = getDb()

  console.log(`⚡ Forzando prompt de reactivación para ${userEmail} (ID: ${userId})`)

  // Verificar que el usuario existe
  const [userProfile] = await db
    .select({
      id: userProfiles.id,
      email: userProfiles.email,
      fullName: userProfiles.fullName
    })
    .from(userProfiles)
    .where(eq(userProfiles.id, userId))
    .limit(1)

  if (!userProfile) {
    throw new Error('USER_NOT_FOUND')
  }

  // Reiniciar configuración de notificaciones para forzar prompt
  await db
    .insert(userNotificationSettings)
    .values({
      userId,
      pushEnabled: false,
      pushSubscription: null,
      updatedAt: new Date().toISOString()
    })
    .onConflictDoUpdate({
      target: userNotificationSettings.userId,
      set: {
        pushEnabled: false,
        pushSubscription: null,
        updatedAt: new Date().toISOString()
      }
    })

  // Registrar evento de admin para tracking (no crítico)
  try {
    await db.insert(notificationEvents).values({
      userId,
      eventType: 'settings_updated',
      notificationType: 'reactivation',
      deviceInfo: {
        action: 'force_reactivation_prompt',
        admin_user: forcedBy,
        timestamp: new Date().toISOString()
      },
      browserInfo: {
        forced_by_admin: true,
        admin_email: forcedBy
      },
      notificationData: {
        title: 'Admin Action: Forced Reactivation Prompt',
        body: `Administrator ${forcedBy} forced reactivation prompt for user ${userEmail}`,
        category: 'admin_management',
        admin_action: true
      },
      userAgent: 'admin-force-reactivation',
      createdAt: new Date().toISOString()
    })
  } catch (trackingError) {
    console.error('⚠️ Error registrando evento admin (no crítico):', trackingError)
  }

  console.log(`✅ Prompt de reactivación forzado exitosamente para ${userEmail}`)

  return {
    success: true,
    message: `Prompt de reactivación forzado exitosamente para ${userEmail}`,
    details: {
      userId,
      userEmail,
      action: 'Configuration reset to force reactivation prompt',
      forcedBy,
      timestamp: new Date().toISOString(),
      nextStep: 'User will see activation prompt on next app visit'
    }
  }
}
