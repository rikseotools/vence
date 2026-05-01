// lib/api/v2/complete-onboarding/queries.ts
// Server-side: guardar todos los campos del onboarding en una sola operación atómica
import { getDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { invalidateProfileCache } from '@/lib/api/profile'
import type { CompleteOnboardingRequest, CompleteOnboardingResponse } from './schemas'

export async function completeOnboarding(
  params: CompleteOnboardingRequest,
  userId: string,
): Promise<CompleteOnboardingResponse> {
  const db = getDb()

  const updates: Record<string, unknown> = {
    targetOposicion: params.targetOposicion,
    age: params.age,
    gender: params.gender,
    ciudad: params.ciudad,
    onboardingCompletedAt: new Date().toISOString(),
    onboardingSkipCount: 0,
    onboardingLastSkipAt: null,
  }

  if (params.targetOposicionData) {
    updates.targetOposicionData = params.targetOposicionData
  }

  if (params.dailyStudyHours) {
    updates.dailyStudyHours = params.dailyStudyHours
  }

  const [result] = await db
    .update(userProfiles)
    .set(updates)
    .where(eq(userProfiles.id, userId))
    .returning({ id: userProfiles.id })

  if (!result) {
    console.error('❌ [complete-onboarding] Usuario no encontrado:', userId)
    return { success: false, error: 'Usuario no encontrado' }
  }

  invalidateProfileCache()
  console.log(`✅ [complete-onboarding] Onboarding completado para ${userId}`)
  return { success: true }
}
