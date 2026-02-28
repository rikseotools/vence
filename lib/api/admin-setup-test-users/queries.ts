// lib/api/admin-setup-test-users/queries.ts
import { getDb } from '@/db/client'
import { userProfiles, userNotificationSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { SetupTestUsersResponse, TestUserResult } from './schemas'

// Usuarios de prueba hardcodeados
const TEST_USER_EMAILS = [
  'manueltrader@gmail.com',
  'alvarodelasheras960@gmail.com',
  'ilovetestpro@gmail.com'
]

// ============================================
// CONFIGURAR USUARIOS DE PRUEBA PARA PUSH
// ============================================

export async function setupTestUsers(): Promise<SetupTestUsersResponse> {
  const db = getDb()
  const results: TestUserResult[] = []

  console.log('🔧 Configurando usuarios de prueba para testing push...')

  for (const email of TEST_USER_EMAILS) {
    try {
      // Buscar el usuario
      const [userProfile] = await db
        .select({
          id: userProfiles.id,
          email: userProfiles.email,
          fullName: userProfiles.fullName
        })
        .from(userProfiles)
        .where(eq(userProfiles.email, email))
        .limit(1)

      if (!userProfile) {
        results.push({ email, status: 'not_found', error: 'User not found' })
        continue
      }

      // Upsert configuración de notificaciones
      await db
        .insert(userNotificationSettings)
        .values({
          userId: userProfile.id,
          pushEnabled: false,
          pushSubscription: null,
          preferredTimes: ['09:00', '14:00', '20:00'],
          timezone: 'Europe/Madrid',
          frequency: 'smart',
          oposicionType: 'auxiliar-administrativo',
          motivationLevel: 'medium',
          updatedAt: new Date().toISOString()
        })
        .onConflictDoUpdate({
          target: userNotificationSettings.userId,
          set: {
            pushEnabled: false,
            pushSubscription: null,
            preferredTimes: ['09:00', '14:00', '20:00'],
            timezone: 'Europe/Madrid',
            frequency: 'smart',
            oposicionType: 'auxiliar-administrativo',
            motivationLevel: 'medium',
            updatedAt: new Date().toISOString()
          }
        })

      results.push({
        email,
        status: 'success',
        user_id: userProfile.id,
        name: userProfile.fullName
      })
      console.log(`✅ ${email} configurado para testing`)

    } catch (userError) {
      results.push({
        email,
        status: 'error',
        error: userError instanceof Error ? userError.message : 'Unknown error'
      })
    }
  }

  const successCount = results.filter(r => r.status === 'success').length

  return {
    success: true,
    message: `Configurados ${successCount} usuarios de prueba para testing push`,
    results
  }
}
