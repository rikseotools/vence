// lib/api/profile/queries.ts - Queries tipadas para perfil de usuario
import { getDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type {
  GetProfileRequest,
  GetProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ProfileData
} from './schemas'

// ============================================
// OBTENER PERFIL POR USER ID
// ============================================

export async function getProfile(
  params: GetProfileRequest
): Promise<GetProfileResponse> {
  try {
    const db = getDb()

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, params.userId))
      .limit(1)

    if (!profile) {
      return {
        success: false,
        error: 'Perfil no encontrado'
      }
    }

    console.log('👤 [Profile] Perfil obtenido:', {
      id: profile.id,
      email: profile.email,
      planType: profile.planType
    })

    return {
      success: true,
      data: profile as ProfileData
    }

  } catch (error) {
    console.error('❌ [Profile] Error obteniendo perfil:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// ACTUALIZAR PERFIL
// ============================================

export async function updateProfile(
  params: UpdateProfileRequest
): Promise<UpdateProfileResponse> {
  try {
    const db = getDb()

    // Construir objeto de actualización con timestamps
    const updateData: Record<string, unknown> = {
      ...params.data,
      updatedAt: new Date().toISOString()
    }

    const [updated] = await db
      .update(userProfiles)
      .set(updateData)
      .where(eq(userProfiles.id, params.userId))
      .returning()

    if (!updated) {
      return {
        success: false,
        error: 'No se pudo actualizar el perfil'
      }
    }

    console.log('✅ [Profile] Perfil actualizado:', {
      id: updated.id,
      fields: Object.keys(params.data)
    })

    return {
      success: true,
      data: updated as ProfileData
    }

  } catch (error) {
    console.error('❌ [Profile] Error actualizando perfil:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// VERIFICAR SI PERFIL EXISTE
// ============================================

export async function profileExists(userId: string): Promise<boolean> {
  try {
    const db = getDb()

    const [result] = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    return !!result

  } catch (error) {
    console.error('❌ [Profile] Error verificando existencia:', error)
    return false
  }
}
