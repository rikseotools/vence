// lib/api/profile/queries.ts - Queries tipadas para perfil de usuario
import { getDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type {
  GetProfileRequest,
  GetProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  ProfileData,
  SelfProfileData,
  AdminProfileData,
  GetSelfProfileResponse,
  GetAdminProfileResponse
} from './schemas'

// ============================================
// PROYECCIONES POR TIER
// ============================================
// Listas explícitas de columnas según tier de visibilidad. Mantener en sync con
// selfProfileDataSchema / adminProfileDataSchema en ./schemas.ts.

const SELF_PROFILE_COLUMNS = {
  id: userProfiles.id,
  email: userProfiles.email,
  fullName: userProfiles.fullName,
  avatarUrl: userProfiles.avatarUrl,
  preferredLanguage: userProfiles.preferredLanguage,
  studyGoal: userProfiles.studyGoal,
  createdAt: userProfiles.createdAt,
  updatedAt: userProfiles.updatedAt,
  targetOposicion: userProfiles.targetOposicion,
  targetOposicionData: userProfiles.targetOposicionData,
  firstOposicionDetectedAt: userProfiles.firstOposicionDetectedAt,
  isActiveStudent: userProfiles.isActiveStudent,
  firstTestCompletedAt: userProfiles.firstTestCompletedAt,
  planType: userProfiles.planType,
  registrationDate: userProfiles.registrationDate,
  trialEndDate: userProfiles.trialEndDate,
  registrationSource: userProfiles.registrationSource,
  requiresPayment: userProfiles.requiresPayment,
  nickname: userProfiles.nickname,
  age: userProfiles.age,
  gender: userProfiles.gender,
  dailyStudyHours: userProfiles.dailyStudyHours,
  onboardingCompletedAt: userProfiles.onboardingCompletedAt,
  ciudad: userProfiles.ciudad,
  onboardingSkipCount: userProfiles.onboardingSkipCount,
  onboardingLastSkipAt: userProfiles.onboardingLastSkipAt,
  registrationFunnel: userProfiles.registrationFunnel
} as const

const ADMIN_PROFILE_COLUMNS = {
  ...SELF_PROFILE_COLUMNS,
  stripeCustomerId: userProfiles.stripeCustomerId,
  registrationIp: userProfiles.registrationIp,
  registrationUrl: userProfiles.registrationUrl,
  adminNotes: userProfiles.adminNotes
} as const

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
// OBTENER PERFIL POR USER ID — TIER SELF
// ============================================
// Devuelve sólo las columnas seguras para el dueño del perfil.
// Excluye stripeCustomerId, registrationIp, registrationUrl, adminNotes.
// Llamar cuando sessionUser.id === requestedUserId.

export async function getProfileForSelf(
  params: GetProfileRequest
): Promise<GetSelfProfileResponse> {
  try {
    const db = getDb()

    const [profile] = await db
      .select(SELF_PROFILE_COLUMNS)
      .from(userProfiles)
      .where(eq(userProfiles.id, params.userId))
      .limit(1)

    if (!profile) {
      return {
        success: false,
        error: 'Perfil no encontrado'
      }
    }

    return {
      success: true,
      data: profile as SelfProfileData
    }

  } catch (error) {
    console.error('❌ [Profile] Error obteniendo perfil (self):', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// OBTENER PERFIL POR USER ID — TIER ADMIN
// ============================================
// Devuelve todas las columnas, incluidas las sensibles. Llamar SOLO tras
// verificar que el caller es admin (isAdminEmail).

export async function getProfileForAdmin(
  params: GetProfileRequest
): Promise<GetAdminProfileResponse> {
  try {
    const db = getDb()

    const [profile] = await db
      .select(ADMIN_PROFILE_COLUMNS)
      .from(userProfiles)
      .where(eq(userProfiles.id, params.userId))
      .limit(1)

    if (!profile) {
      return {
        success: false,
        error: 'Perfil no encontrado'
      }
    }

    return {
      success: true,
      data: profile as AdminProfileData
    }

  } catch (error) {
    console.error('❌ [Profile] Error obteniendo perfil (admin):', error)
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
