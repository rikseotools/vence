/**
 * API Cron: Rotación Semanal de Avatares Automáticos
 *
 * Endpoint: POST /api/cron/avatar-rotation
 * Schedule: Cada lunes a las 8:00 (configurar en Vercel/cron provider)
 *
 * Requiere: Authorization: Bearer {CRON_SECRET}
 *
 * Proceso:
 * 1. Obtiene todos los usuarios con avatar en modo automático
 * 2. Calcula el nuevo perfil basado en métricas de la última semana
 * 3. Actualiza el avatar si el perfil cambió
 * 4. Envía notificación push a los usuarios cuyo avatar cambió
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  getUsersWithAutomaticAvatar,
  calculateBulkUserProfiles,
  getAllAvatarProfiles,
  type AvatarProfile
} from '@/lib/api/avatar-settings'

// Cliente de Supabase con service role
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// ============================================
// POST: Ejecutar rotación de avatares
// ============================================

export async function POST(request: NextRequest) {
  // 1. Verificar autorización
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

  if (authHeader !== expectedAuth) {
    console.error('❌ [avatar-rotation] Unauthorized request')
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const startTime = Date.now()

  try {
    console.log('🔄 [avatar-rotation] Iniciando rotación semanal de avatares')

    // 2. Obtener usuarios en modo automático
    const userIds = await getUsersWithAutomaticAvatar()

    if (userIds.length === 0) {
      console.log('ℹ️ [avatar-rotation] No hay usuarios en modo automático')
      return NextResponse.json({
        success: true,
        stats: {
          totalUsers: 0,
          rotated: 0,
          unchanged: 0,
          errors: 0
        },
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        timestamp: new Date().toISOString()
      })
    }

    console.log(`📊 [avatar-rotation] Procesando ${userIds.length} usuarios`)

    // 3. Obtener configuración actual de todos los usuarios
    const supabase = getSupabaseAdmin()
    const { data: currentSettings } = await supabase
      .from('user_avatar_settings')
      .select('user_id, current_profile, current_emoji')
      .in('user_id', userIds)

    const currentSettingsMap = new Map(
      (currentSettings || []).map(s => [s.user_id, s])
    )

    // 4. Calcular perfiles en bulk (batches paralelos de 20)
    const bulkResults = await calculateBulkUserProfiles(userIds)

    // 5. Obtener todos los perfiles para el mapeo
    const allProfiles = await getAllAvatarProfiles()
    const profilesMap = new Map<string, AvatarProfile>(allProfiles.map(p => [p.id, p]))

    // 6. Procesar resultados y preparar updates
    const stats = {
      totalUsers: userIds.length,
      rotated: 0,
      unchanged: 0,
      errors: 0
    }
    const rotatedUsers: Array<{
      userId: string
      previousProfile: string | null
      newProfile: string
      emoji: string
    }> = []

    const updates: Array<{
      userId: string
      profileId: string
      emoji: string
      name: string
      previousProfile: string | null
      previousEmoji: string | null
    }> = []

    for (const result of bulkResults) {
      const current = currentSettingsMap.get(result.userId)
      const previousProfile = current?.current_profile || null
      const profile = profilesMap.get(result.profileId)

      if (!profile) {
        stats.errors++
        continue
      }

      if (previousProfile === result.profileId) {
        stats.unchanged++
        continue
      }

      updates.push({
        userId: result.userId,
        profileId: result.profileId,
        emoji: profile.emoji,
        name: profile.nameEs,
        previousProfile,
        previousEmoji: current?.current_emoji || null
      })
    }

    // 7. Aplicar updates en batches
    const UPDATE_BATCH_SIZE = 50
    for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
      const batch = updates.slice(i, i + UPDATE_BATCH_SIZE)

      await Promise.all(batch.map(async (update) => {
        const { error } = await supabase
          .from('user_avatar_settings')
          .update({
            current_profile: update.profileId,
            current_emoji: update.emoji,
            current_name: update.name,
            last_rotation_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            rotation_notification_pending: true,
            previous_profile: update.previousProfile,
            previous_emoji: update.previousEmoji
          })
          .eq('user_id', update.userId)

        if (!error) {
          stats.rotated++
          rotatedUsers.push({
            userId: update.userId,
            previousProfile: update.previousProfile,
            newProfile: update.profileId,
            emoji: update.emoji
          })
        } else {
          console.error(`❌ [avatar-rotation] Error actualizando ${update.userId}:`, error)
          stats.errors++
        }
      }))

      console.log(`💾 [avatar-rotation] Updates aplicados: ${Math.min(i + UPDATE_BATCH_SIZE, updates.length)}/${updates.length}`)
    }

    // 4. Enviar notificaciones a usuarios con avatar cambiado
    if (rotatedUsers.length > 0) {
      await sendAvatarChangeNotifications(rotatedUsers)
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1)

    console.log(`✅ [avatar-rotation] Completado en ${duration}s - Rotados: ${stats.rotated}, Sin cambio: ${stats.unchanged}, Errores: ${stats.errors}`)

    return NextResponse.json({
      success: true,
      stats,
      rotatedUsers: rotatedUsers.map(u => ({
        userId: u.userId,
        newProfile: u.newProfile,
        emoji: u.emoji
      })),
      duration: `${duration}s`,
      timestamp: new Date().toISOString()
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('❌ [avatar-rotation] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// ============================================
// GET: Para health check / verificación manual
// ============================================

export async function GET(request: NextRequest) {
  // Verificar autorización
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

  if (authHeader !== expectedAuth) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const userIds = await getUsersWithAutomaticAvatar()

    return NextResponse.json({
      success: true,
      status: 'healthy',
      usersInAutomaticMode: userIds.length,
      timestamp: new Date().toISOString()
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        status: 'unhealthy',
        error: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// ============================================
// HELPER: Enviar notificaciones de cambio de avatar
// ============================================

async function sendAvatarChangeNotifications(
  rotatedUsers: Array<{
    userId: string
    previousProfile: string | null
    newProfile: string
    emoji: string
  }>
): Promise<void> {
  const supabase = getSupabaseAdmin()

  // Obtener suscripciones push de los usuarios
  for (const user of rotatedUsers) {
    try {
      // Buscar si el usuario tiene notificaciones push habilitadas
      const { data: notifSettings } = await supabase
        .from('user_notification_settings')
        .select('push_enabled, push_subscription')
        .eq('user_id', user.userId)
        .single()

      if (!notifSettings?.push_enabled || !notifSettings?.push_subscription) {
        continue
      }

      // Obtener género del usuario para usar el nombre correcto
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('gender')
        .eq('id', user.userId)
        .single()

      const isFemale = userProfile?.gender === 'female' || userProfile?.gender === 'mujer'

      // Obtener nombre del perfil para el mensaje (con versión femenina si existe)
      const { data: profileData } = await supabase
        .from('avatar_profiles')
        .select('name_es, name_es_f, description_es')
        .eq('id', user.newProfile)
        .single()

      if (!profileData) continue

      // Usar nombre femenino si el usuario es mujer y existe versión femenina
      const profileName = (isFemale && profileData.name_es_f)
        ? profileData.name_es_f
        : profileData.name_es

      const notificationPayload = {
        title: `${user.emoji} ¡Nuevo avatar esta semana!`,
        body: `Eres ${profileName}. ${profileData.description_es}`,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'avatar-rotation',
        data: {
          type: 'avatar_rotation',
          url: '/perfil',
          newProfile: user.newProfile
        }
      }

      // Registrar evento de notificación
      await supabase.from('notification_events').insert({
        user_id: user.userId,
        event_type: 'notification_sent',
        notification_type: 'achievement',
        notification_data: notificationPayload
      })

      // En producción, aquí se enviaría la notificación push real
      // usando web-push o el servicio de notificaciones
      console.log(`📱 [avatar-rotation] Notificación preparada para ${user.userId}: ${user.emoji} ${profileName}`)

    } catch (notifError) {
      console.warn(`⚠️ [avatar-rotation] Error enviando notificación a ${user.userId}:`, notifError)
    }
  }
}
