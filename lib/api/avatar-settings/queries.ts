// lib/api/avatar-settings/queries.ts - Queries para configuración de avatares
//
// Migrado de supabase.from()/.rpc() (PostgREST) a Drizzle (2026-06-01,
// agnosticismo Fase 3). getAdminDb() es el portal privilegiado para
// operaciones de servidor (incluye writes: upsert/update), agnóstico a si por
// debajo es Supabase, RDS o Neon. La RPC pasa a db.execute(sql`SELECT ... FROM
// fn(...)`), que sigue siendo una función SQL estándar.
import { desc, eq, sql } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { avatarProfiles, userAvatarSettings } from '@/db/schema'
import type {
  GetAvatarSettingsRequest,
  GetAvatarSettingsResponse,
  UpdateAvatarSettingsRequest,
  UpdateAvatarSettingsResponse,
  UserAvatarSettingsData,
  AvatarProfile
} from './schemas'

// ============================================
// OBTENER TODOS LOS PERFILES DE AVATAR
// ============================================

export async function getAllAvatarProfiles(): Promise<AvatarProfile[]> {
  try {
    const db = getAdminDb()

    const rows = await db
      .select({
        id: avatarProfiles.id,
        emoji: avatarProfiles.emoji,
        nameEs: avatarProfiles.nameEs,
        nameEsF: avatarProfiles.nameEsF,
        descriptionEs: avatarProfiles.descriptionEs,
        color: avatarProfiles.color,
        priority: avatarProfiles.priority,
      })
      .from(avatarProfiles)
      .orderBy(desc(avatarProfiles.priority))

    return rows.map(p => ({
      id: p.id,
      emoji: p.emoji,
      nameEs: p.nameEs,
      nameEsF: p.nameEsF,
      descriptionEs: p.descriptionEs,
      color: p.color,
      priority: p.priority ?? 50
    }))
  } catch (error) {
    console.error('❌ [AvatarSettings] Error en getAllAvatarProfiles:', error)
    return []
  }
}

// ============================================
// OBTENER PERFIL DE AVATAR POR ID
// ============================================

export async function getAvatarProfileById(profileId: string): Promise<AvatarProfile | null> {
  try {
    const db = getAdminDb()

    const rows = await db
      .select({
        id: avatarProfiles.id,
        emoji: avatarProfiles.emoji,
        nameEs: avatarProfiles.nameEs,
        nameEsF: avatarProfiles.nameEsF,
        descriptionEs: avatarProfiles.descriptionEs,
        color: avatarProfiles.color,
        priority: avatarProfiles.priority,
      })
      .from(avatarProfiles)
      .where(eq(avatarProfiles.id, profileId))
      .limit(1)
    const data = rows[0]

    if (!data) {
      return null
    }

    return {
      id: data.id,
      emoji: data.emoji,
      nameEs: data.nameEs,
      nameEsF: data.nameEsF,
      descriptionEs: data.descriptionEs,
      color: data.color,
      priority: data.priority ?? 50
    }
  } catch (error) {
    console.error('❌ [AvatarSettings] Error en getAvatarProfileById:', error)
    return null
  }
}

// ============================================
// OBTENER CONFIGURACIÓN DE AVATAR POR USER ID
// ============================================

export async function getAvatarSettings(
  params: GetAvatarSettingsRequest
): Promise<GetAvatarSettingsResponse> {
  try {
    const db = getAdminDb()

    const rows = await db
      .select()
      .from(userAvatarSettings)
      .where(eq(userAvatarSettings.userId, params.userId))
      .limit(1)
    const settings = rows[0]

    // Si no existe, devolver configuración por defecto (antes: PGRST116)
    if (!settings) {
      console.log('🦊 [AvatarSettings] Sin configuración previa para usuario:', params.userId)

      const allProfiles = await getAllAvatarProfiles()

      return {
        success: true,
        data: {
          id: '',
          userId: params.userId,
          mode: 'automatic', // Por defecto activado
          currentProfile: null,
          currentEmoji: null,
          currentName: null,
          lastRotationAt: null,
          createdAt: null,
          updatedAt: null
        },
        allProfiles
      }
    }

    console.log('🦊 [AvatarSettings] Configuración obtenida:', {
      userId: settings.userId,
      mode: settings.mode,
      currentProfile: settings.currentProfile
    })

    // Obtener perfil actual si existe
    let profile: AvatarProfile | undefined
    if (settings.currentProfile) {
      const foundProfile = await getAvatarProfileById(settings.currentProfile)
      if (foundProfile) {
        profile = foundProfile
      }
    }

    // Obtener todos los perfiles disponibles
    const allProfiles = await getAllAvatarProfiles()

    const data: UserAvatarSettingsData = {
      id: settings.id,
      userId: settings.userId ?? params.userId,
      mode: (settings.mode ?? 'automatic') as 'automatic' | 'manual',
      currentProfile: settings.currentProfile,
      currentEmoji: settings.currentEmoji,
      currentName: settings.currentName,
      lastRotationAt: settings.lastRotationAt,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    }

    return {
      success: true,
      data,
      profile,
      allProfiles
    }

  } catch (error) {
    console.error('❌ [AvatarSettings] Error en getAvatarSettings:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// UPSERT CONFIGURACIÓN DE AVATAR
// ============================================

export async function updateAvatarSettings(
  params: UpdateAvatarSettingsRequest
): Promise<UpdateAvatarSettingsResponse> {
  try {
    const db = getAdminDb()

    // Valores finales del upsert (mismo resultado que el upsert de supabase:
    // si el campo viene definido se usa, si no, el default automatic/null).
    const now = new Date().toISOString()
    const mode = params.data.mode ?? 'automatic'
    const currentProfile = params.data.currentProfile ?? null
    const currentEmoji = params.data.currentEmoji ?? null
    const currentName = params.data.currentName ?? null

    // INSERT ... ON CONFLICT (user_id) DO UPDATE — equivalente al upsert
    // onConflict:'user_id'. Unique constraint user_avatar_settings_user_id_key.
    const upserted = await db
      .insert(userAvatarSettings)
      .values({
        userId: params.userId,
        mode,
        currentProfile,
        currentEmoji,
        currentName,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userAvatarSettings.userId,
        set: { mode, currentProfile, currentEmoji, currentName, updatedAt: now },
      })
      .returning()
    const result = upserted[0]

    console.log('✅ [AvatarSettings] Configuración actualizada:', {
      userId: result.userId,
      mode: result.mode,
      fields: Object.keys(params.data)
    })

    // Obtener perfil actual si existe
    let profile: AvatarProfile | undefined
    if (result.currentProfile) {
      const foundProfile = await getAvatarProfileById(result.currentProfile)
      if (foundProfile) {
        profile = foundProfile
      }
    }

    const data: UserAvatarSettingsData = {
      id: result.id,
      userId: result.userId ?? params.userId,
      mode: (result.mode ?? 'automatic') as 'automatic' | 'manual',
      currentProfile: result.currentProfile,
      currentEmoji: result.currentEmoji,
      currentName: result.currentName,
      lastRotationAt: result.lastRotationAt,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    }

    return {
      success: true,
      data,
      profile
    }

  } catch (error) {
    console.error('❌ [AvatarSettings] Error en updateAvatarSettings:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// OBTENER USUARIOS ACTIVOS EN MODO AUTOMÁTICO
// ============================================

/**
 * Obtiene usuarios con avatar automático que tuvieron actividad reciente.
 * Solo procesa usuarios activos para eficiencia (100k usuarios → solo ~5k activos).
 * Los usuarios inactivos mantienen su avatar anterior.
 *
 * @param daysBack - Días hacia atrás para considerar actividad (default: 7)
 */
export async function getUsersWithAutomaticAvatar(daysBack: number = 7): Promise<string[]> {
  try {
    const db = getAdminDb()

    // Función SQL optimizada que filtra por actividad (antes supabase.rpc()).
    const rows = (await db.execute(
      sql`SELECT user_id FROM get_active_users_with_automatic_avatar(${daysBack})`
    )) as unknown as Array<{ user_id: string }>

    const userIds = rows.map(row => row.user_id)
    console.log(`📊 [AvatarSettings] Usuarios activos en modo automático: ${userIds.length}`)
    return userIds
  } catch (error) {
    console.error('❌ [AvatarSettings] Error en RPC get_active_users_with_automatic_avatar:', error)
    // Fallback: método tradicional (menos eficiente)
    return getUsersWithAutomaticAvatarFallback()
  }
}

/**
 * Fallback: obtiene TODOS los usuarios en modo automático (menos eficiente).
 * Se usa si la función SQL no está disponible.
 */
async function getUsersWithAutomaticAvatarFallback(): Promise<string[]> {
  try {
    console.warn('⚠️ [AvatarSettings] Usando fallback - obteniendo todos los usuarios automáticos')
    const db = getAdminDb()

    const rows = await db
      .select({ userId: userAvatarSettings.userId })
      .from(userAvatarSettings)
      .where(eq(userAvatarSettings.mode, 'automatic'))

    return rows.map(row => row.userId).filter((id): id is string => id !== null)
  } catch (error) {
    console.error('❌ [AvatarSettings] Error en getUsersWithAutomaticAvatarFallback:', error)
    return []
  }
}

// ============================================
// ACTUALIZAR ROTACIÓN DE AVATAR
// ============================================

export async function updateAvatarRotation(
  userId: string,
  profile: AvatarProfile
): Promise<boolean> {
  try {
    const db = getAdminDb()

    await db
      .update(userAvatarSettings)
      .set({
        currentProfile: profile.id,
        currentEmoji: profile.emoji,
        currentName: profile.nameEs,
        lastRotationAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .where(eq(userAvatarSettings.userId, userId))

    console.log('🔄 [AvatarSettings] Rotación completada:', {
      userId,
      newProfile: profile.id,
      emoji: profile.emoji
    })

    return true
  } catch (error) {
    console.error('❌ [AvatarSettings] Error en updateAvatarRotation:', error)
    return false
  }
}
