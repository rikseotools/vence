// lib/api/admin-check-push-status/queries.ts
import { getDb } from '@/db/client'
import { userProfiles, userNotificationSettings } from '@/db/schema'
import { desc } from 'drizzle-orm'
import type { CheckPushStatusResponse, UserPushDetail } from './schemas'

// ============================================
// VERIFICAR ESTADO PUSH DE TODOS LOS USUARIOS
// ============================================

export async function checkAllPushStatus(): Promise<CheckPushStatusResponse> {
  const db = getDb()

  console.log('🔍 Iniciando verificación masiva de estado push...')

  // Obtener todos los usuarios
  const usersData = await db
    .select({
      id: userProfiles.id,
      email: userProfiles.email,
      fullName: userProfiles.fullName,
      createdAt: userProfiles.createdAt
    })
    .from(userProfiles)
    .orderBy(desc(userProfiles.createdAt))

  console.log(`📊 Analizando ${usersData.length} usuarios...`)

  // Obtener configuraciones de notificaciones
  const notifSettings = await db
    .select({
      userId: userNotificationSettings.userId,
      pushEnabled: userNotificationSettings.pushEnabled,
      pushSubscription: userNotificationSettings.pushSubscription,
      createdAt: userNotificationSettings.createdAt,
      updatedAt: userNotificationSettings.updatedAt
    })
    .from(userNotificationSettings)

  // Crear mapa de settings por userId
  const settingsMap = new Map(notifSettings.map(ns => [ns.userId, ns]))

  const stats = {
    totalUsers: usersData.length,
    activeUsers: 0,
    inactiveUsers: 0,
    expiredUsers: 0,
    neverConfigured: 0,
    details: [] as UserPushDetail[]
  }

  const userDetails: UserPushDetail[] = []

  for (const user of usersData) {
    const userSettings = settingsMap.get(user.id)

    let status: UserPushDetail['status'] = 'never_configured'
    let statusLabel = '❌ Nunca configurado'
    let details = 'Usuario nunca ha configurado notificaciones'

    if (userSettings) {
      if (userSettings.pushEnabled && userSettings.pushSubscription) {
        try {
          const subscription = typeof userSettings.pushSubscription === 'string'
            ? JSON.parse(userSettings.pushSubscription)
            : userSettings.pushSubscription
          const isFakeSubscription = subscription.endpoint?.includes('FAKE_ENDPOINT_FOR_TESTING')

          if (isFakeSubscription) {
            status = 'test_user'
            statusLabel = '🧪 Usuario de prueba'
            details = 'Configurado con suscripción fake para testing'
          } else {
            status = 'active'
            statusLabel = '🟢 Activo'
            details = 'Push notifications habilitadas con suscripción real'
          }
        } catch {
          status = 'invalid_subscription'
          statusLabel = '⚠️ Suscripción inválida'
          details = 'Configuración corrupta, necesita reconfiguración'
        }
      } else {
        status = 'inactive'
        statusLabel = '🔴 Inactivo'
        details = 'Configuración existente pero push deshabilitado'
      }
    }

    switch (status) {
      case 'active':
        stats.activeUsers++
        break
      case 'inactive':
        stats.inactiveUsers++
        break
      case 'invalid_subscription':
        stats.expiredUsers++
        break
      case 'never_configured':
        stats.neverConfigured++
        break
    }

    userDetails.push({
      id: user.id,
      email: user.email,
      name: user.fullName || 'Sin nombre',
      status,
      statusLabel,
      details,
      created: user.createdAt?.substring(0, 10) ?? null,
      lastUpdate: userSettings?.updatedAt?.substring(0, 10) || 'Nunca'
    })
  }

  stats.details = userDetails.slice(0, 10)

  console.log('📊 Estadísticas finales:', {
    total: stats.totalUsers,
    active: stats.activeUsers,
    inactive: stats.inactiveUsers,
    expired: stats.expiredUsers,
    never: stats.neverConfigured
  })

  return {
    success: true,
    message: 'Verificación de estado completada exitosamente',
    stats,
    timestamp: new Date().toISOString(),
    summary: `${stats.activeUsers} activos de ${stats.totalUsers} usuarios totales`
  }
}
