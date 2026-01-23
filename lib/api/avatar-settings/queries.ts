// lib/api/avatar-settings/queries.ts - Queries para configuración de avatares
import { createClient } from '@supabase/supabase-js'
import type {
  GetAvatarSettingsRequest,
  GetAvatarSettingsResponse,
  UpdateAvatarSettingsRequest,
  UpdateAvatarSettingsResponse,
  UserAvatarSettingsData,
  AvatarProfile
} from './schemas'

// Cliente de Supabase con service role para operaciones de servidor
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// ============================================
// OBTENER TODOS LOS PERFILES DE AVATAR
// ============================================

export async function getAllAvatarProfiles(): Promise<AvatarProfile[]> {
  try {
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('avatar_profiles')
      .select('id, emoji, name_es, name_es_f, description_es, color, priority')
      .order('priority', { ascending: false })

    if (error) {
      console.error('❌ [AvatarSettings] Error obteniendo perfiles:', error)
      return []
    }

    return (data || []).map(p => ({
      id: p.id,
      emoji: p.emoji,
      nameEs: p.name_es,
      nameEsF: p.name_es_f,
      descriptionEs: p.description_es,
      color: p.color,
      priority: p.priority
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
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('avatar_profiles')
      .select('id, emoji, name_es, name_es_f, description_es, color, priority')
      .eq('id', profileId)
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      emoji: data.emoji,
      nameEs: data.name_es,
      nameEsF: data.name_es_f,
      descriptionEs: data.description_es,
      color: data.color,
      priority: data.priority
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
    const supabase = getSupabaseAdmin()

    const { data: settings, error } = await supabase
      .from('user_avatar_settings')
      .select('*')
      .eq('user_id', params.userId)
      .single()

    // Si no existe, devolver configuración por defecto
    if (error && error.code === 'PGRST116') {
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

    if (error) {
      console.error('❌ [AvatarSettings] Error obteniendo configuración:', error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log('🦊 [AvatarSettings] Configuración obtenida:', {
      userId: settings.user_id,
      mode: settings.mode,
      currentProfile: settings.current_profile
    })

    // Obtener perfil actual si existe
    let profile: AvatarProfile | undefined
    if (settings.current_profile) {
      const foundProfile = await getAvatarProfileById(settings.current_profile)
      if (foundProfile) {
        profile = foundProfile
      }
    }

    // Obtener todos los perfiles disponibles
    const allProfiles = await getAllAvatarProfiles()

    const data: UserAvatarSettingsData = {
      id: settings.id,
      userId: settings.user_id,
      mode: settings.mode,
      currentProfile: settings.current_profile,
      currentEmoji: settings.current_emoji,
      currentName: settings.current_name,
      lastRotationAt: settings.last_rotation_at,
      createdAt: settings.created_at,
      updatedAt: settings.updated_at
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
    const supabase = getSupabaseAdmin()

    // Construir objeto de actualización con nombres de columna snake_case
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (params.data.mode !== undefined) {
      updateData.mode = params.data.mode
    }
    if (params.data.currentProfile !== undefined) {
      updateData.current_profile = params.data.currentProfile
    }
    if (params.data.currentEmoji !== undefined) {
      updateData.current_emoji = params.data.currentEmoji
    }
    if (params.data.currentName !== undefined) {
      updateData.current_name = params.data.currentName
    }

    // Intentar upsert
    const { data: result, error } = await supabase
      .from('user_avatar_settings')
      .upsert({
        user_id: params.userId,
        mode: params.data.mode ?? 'automatic', // Por defecto activado
        current_profile: params.data.currentProfile ?? null,
        current_emoji: params.data.currentEmoji ?? null,
        current_name: params.data.currentName ?? null,
        ...updateData
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) {
      console.error('❌ [AvatarSettings] Error actualizando configuración:', error)
      return {
        success: false,
        error: error.message
      }
    }

    console.log('✅ [AvatarSettings] Configuración actualizada:', {
      userId: result.user_id,
      mode: result.mode,
      fields: Object.keys(params.data)
    })

    // Obtener perfil actual si existe
    let profile: AvatarProfile | undefined
    if (result.current_profile) {
      const foundProfile = await getAvatarProfileById(result.current_profile)
      if (foundProfile) {
        profile = foundProfile
      }
    }

    const data: UserAvatarSettingsData = {
      id: result.id,
      userId: result.user_id,
      mode: result.mode,
      currentProfile: result.current_profile,
      currentEmoji: result.current_emoji,
      currentName: result.current_name,
      lastRotationAt: result.last_rotation_at,
      createdAt: result.created_at,
      updatedAt: result.updated_at
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
    const supabase = getSupabaseAdmin()

    // Usar función RPC optimizada que filtra por actividad
    const { data, error } = await supabase.rpc('get_active_users_with_automatic_avatar', {
      p_days_back: daysBack
    })

    if (error) {
      console.error('❌ [AvatarSettings] Error en RPC get_active_users_with_automatic_avatar:', error)
      // Fallback: método tradicional (menos eficiente)
      return getUsersWithAutomaticAvatarFallback()
    }

    const userIds = (data || []).map((row: { user_id: string }) => row.user_id)
    console.log(`📊 [AvatarSettings] Usuarios activos en modo automático: ${userIds.length}`)
    return userIds
  } catch (error) {
    console.error('❌ [AvatarSettings] Error en getUsersWithAutomaticAvatar:', error)
    return []
  }
}

/**
 * Fallback: obtiene TODOS los usuarios en modo automático (menos eficiente).
 * Se usa si la función RPC no está disponible.
 */
async function getUsersWithAutomaticAvatarFallback(): Promise<string[]> {
  try {
    console.warn('⚠️ [AvatarSettings] Usando fallback - obteniendo todos los usuarios automáticos')
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('user_avatar_settings')
      .select('user_id')
      .eq('mode', 'automatic')

    if (error) {
      console.error('❌ [AvatarSettings] Error en fallback:', error)
      return []
    }

    return (data || []).map(row => row.user_id)
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
    const supabase = getSupabaseAdmin()

    const { error } = await supabase
      .from('user_avatar_settings')
      .update({
        current_profile: profile.id,
        current_emoji: profile.emoji,
        current_name: profile.nameEs,
        last_rotation_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)

    if (error) {
      console.error('❌ [AvatarSettings] Error actualizando rotación:', error)
      return false
    }

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
