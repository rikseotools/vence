// lib/api/v2/complete-onboarding/queries.ts
// Server-side: guardar todos los campos del onboarding en una sola operación atómica
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getCompleteOnboardingDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { userProfiles } from '@/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { invalidateProfileCache } from '@/lib/api/profile'
import { emitFireAndForget } from '@/lib/observability/emit'
import type { CompleteOnboardingRequest, CompleteOnboardingResponse } from './schemas'

export async function completeOnboarding(
  params: CompleteOnboardingRequest,
  userId: string,
): Promise<CompleteOnboardingResponse> {
  const db = getCompleteOnboardingDb()

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

  // [T-077] Sin este guardarraíl, un usuario que YA completó el onboarding hace tiempo podía
  // volver a llamar este endpoint (nada en la ruta lo impedía) y pisar su `target_oposicion` —
  // la misma puerta trasera que `save-field` (ver ese fichero). `onboarding_completed_at IS
  // NULL` dice "esto es de verdad la primera vez". `RETURNING` en vez de un SELECT previo: el
  // propio UPDATE es la comprobación, sin ventana entre leer y escribir.
  const [result] = await db
    .update(userProfiles)
    .set(updates)
    .where(and(eq(userProfiles.id, userId), isNull(userProfiles.onboardingCompletedAt)))
    .returning({ id: userProfiles.id })

  if (!result) {
    // Onboarding ya completado (o usuario inexistente) — se distingue, pero las DOS responden
    // `success: true` al cliente: éste es el endpoint del botón «Completar», llamado UNA vez al
    // final y con reintento del lado cliente si hay timeout (ver complete-onboarding/client.ts,
    // "sin retry" en el comentario pero el usuario puede volver a pulsar). Un reintento
    // legítimo manda los MISMOS datos que ya están guardados: decirle "error" rompería un
    // onboarding que en realidad ya terminó bien. Lo que SÍ cambia es que ya NO se sobrescribe
    // el perfil — y eso se OBSERVA, no se silencia del todo: si esto se dispara con volumen,
    // es señal de que algo está reintentando este endpoint fuera del flujo normal.
    const yaCompletado = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)
    if (yaCompletado.length === 0) {
      console.error('❌ [complete-onboarding] Usuario no encontrado:', userId)
      return { success: false, error: 'Usuario no encontrado' }
    }
    emitFireAndForget({
      source: 'vercel',
      severity: 'info',
      eventType: 'complete_onboarding_repetido',
      endpoint: '/api/v2/complete-onboarding',
      metadata: { userId },
    })
    console.log(`ℹ️ [complete-onboarding] Ya estaba completado, no se sobrescribe: ${userId}`)
    return { success: true }
  }

  invalidateProfileCache()
  console.log(`✅ [complete-onboarding] Onboarding completado para ${userId}`)
  return { success: true }
}
