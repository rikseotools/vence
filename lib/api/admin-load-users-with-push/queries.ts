// lib/api/admin-load-users-with-push/queries.ts
import { getDb } from '@/db/client'
import { userProfiles, userNotificationSettings } from '@/db/schema'
import { desc, inArray } from 'drizzle-orm'

// ============================================
// CARGAR USUARIOS CON PUSH HABILITADO
// ============================================

export async function loadUsersWithPush() {
  const db = getDb()

  console.log('🔍 Cargando usuarios con configuraciones de push...')

  // Cargar usuarios (últimos 500)
  const usersData = await db
    .select({
      id: userProfiles.id,
      email: userProfiles.email,
      fullName: userProfiles.fullName,
      createdAt: userProfiles.createdAt
    })
    .from(userProfiles)
    .orderBy(desc(userProfiles.createdAt))
    .limit(500)

  console.log(`👥 ${usersData.length} usuarios cargados`)

  if (usersData.length === 0) {
    return {
      success: true as const,
      users: [],
      stats: { totalUsers: 0, usersWithSettings: 0, usersWithPushEnabled: 0 },
      message: 'No hay usuarios en el sistema'
    }
  }

  const userIds = usersData.map(u => u.id)

  // Cargar configuraciones de notificación
  const notificationSettings = await db
    .select({
      userId: userNotificationSettings.userId,
      pushEnabled: userNotificationSettings.pushEnabled,
      pushSubscription: userNotificationSettings.pushSubscription,
      createdAt: userNotificationSettings.createdAt,
      updatedAt: userNotificationSettings.updatedAt
    })
    .from(userNotificationSettings)
    .where(inArray(userNotificationSettings.userId, userIds))

  console.log(`⚙️ ${notificationSettings.length} configuraciones de notificación cargadas`)

  // Crear mapa de settings por userId
  const settingsMap = new Map(notificationSettings.map(ns => [ns.userId, ns]))

  // Filtrar solo usuarios con push habilitado y suscripción válida
  const usersWithPush = usersData
    .filter(user => {
      const settings = settingsMap.get(user.id)
      return settings && settings.pushEnabled && settings.pushSubscription
    })
    .map(user => ({
      ...user,
      userNotificationSettings: settingsMap.get(user.id)!
    }))

  console.log(`🎯 ${usersWithPush.length} usuarios con push habilitado filtrados`)

  return {
    success: true as const,
    users: usersWithPush,
    stats: {
      totalUsers: usersData.length,
      usersWithSettings: notificationSettings.length,
      usersWithPushEnabled: usersWithPush.length
    },
    message: `${usersWithPush.length} usuarios con push habilitado cargados exitosamente`
  }
}
