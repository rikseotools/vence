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
  updateAvatarRotation,
  getAvatarSettings,
  calculateUserProfile,
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

    // 3. Procesar cada usuario
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

    for (const userId of userIds) {
      try {
        // Obtener configuración actual
        const currentSettings = await getAvatarSettings({ userId })
        const previousProfile = currentSettings.data?.currentProfile || null

        // Calcular nuevo perfil
        const profileResult = await calculateUserProfile({ userId })

        if (!profileResult.success || !profileResult.profile) {
          console.warn(`⚠️ [avatar-rotation] Error calculando perfil para ${userId}:`, profileResult.error)
          stats.errors++
          continue
        }

        const newProfile = profileResult.profile

        // Verificar si cambió
        if (previousProfile === newProfile.id) {
          console.log(`✓ [avatar-rotation] ${userId}: Sin cambio (${newProfile.emoji} ${newProfile.nameEs})`)
          stats.unchanged++
          continue
        }

        // Aplicar rotación con notificación pendiente
        const supabase = getSupabaseAdmin()
        const { error: updateError } = await supabase
          .from('user_avatar_settings')
          .update({
            current_profile: newProfile.id,
            current_emoji: newProfile.emoji,
            current_name: newProfile.nameEs,
            last_rotation_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            // Campos para notificación in-app
            rotation_notification_pending: true,
            previous_profile: previousProfile,
            previous_emoji: currentSettings.data?.currentEmoji || null
          })
          .eq('user_id', userId)

        if (!updateError) {
          stats.rotated++
          rotatedUsers.push({
            userId,
            previousProfile,
            newProfile: newProfile.id,
            emoji: newProfile.emoji
          })
          console.log(`🔄 [avatar-rotation] ${userId}: ${previousProfile || 'ninguno'} → ${newProfile.emoji} ${newProfile.nameEs}`)
        } else {
          console.error(`❌ [avatar-rotation] Error actualizando ${userId}:`, updateError)
          stats.errors++
        }

      } catch (userError) {
        console.error(`❌ [avatar-rotation] Error procesando usuario ${userId}:`, userError)
        stats.errors++
      }
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
