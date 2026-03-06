// lib/api/auth/queries.ts - Logica server-side para auth callback v2 (Drizzle)
import { getDb } from '@/db/client'
import { emailLogs, userProfiles } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { sendEmailV2 } from '@/lib/api/emails/queries'
import type { ProcessCallbackRequest, ProcessCallbackResponse } from './schemas'

// ============================================
// PROCESS AUTH CALLBACK (server-side)
// ============================================

/**
 * Procesa el callback de autenticacion completamente server-side.
 * Detecta usuario nuevo, upsert perfil, welcome email, IP de registro.
 */
export async function processAuthCallback(
  params: ProcessCallbackRequest,
  request: Request
): Promise<ProcessCallbackResponse> {
  const {
    userId,
    userEmail,
    fullName,
    avatarUrl,
    returnUrl,
    oposicion,
    funnel,
    isGoogleAds,
    isGoogleAdsFromUrl,
    isMetaAds,
  } = params

  const db = getDb()

  try {
    // 1. Detectar usuario nuevo (sin welcome email previo)
    const existingWelcomeEmails = await db
      .select({ id: emailLogs.id })
      .from(emailLogs)
      .where(
        and(
          eq(emailLogs.userId, userId),
          eq(emailLogs.emailType, 'bienvenida_inmediato')
        )
      )
      .limit(1)

    const isNewUser = existingWelcomeEmails.length === 0

    console.log('🎯 [AuthCallback/v2] Deteccion usuario nuevo:', { userId, isNewUser })

    // 2. Upsert perfil
    const [existingProfile] = await db
      .select({
        id: userProfiles.id,
        planType: userProfiles.planType,
        registrationSource: userProfiles.registrationSource,
        registrationUrl: userProfiles.registrationUrl,
        registrationFunnel: userProfiles.registrationFunnel,
      })
      .from(userProfiles)
      .where(eq(userProfiles.id, userId))
      .limit(1)

    if (existingProfile) {
      // Perfil existe — actualizar campos no sensibles
      console.log('✅ [AuthCallback/v2] Perfil existente, preservando plan_type:', existingProfile.planType)

      const updateData: Record<string, unknown> = {
        fullName: fullName || userEmail?.split('@')[0],
        avatarUrl: avatarUrl,
        updatedAt: new Date().toISOString(),
      }

      // Solo actualizar registration_source si es 'organic' o null
      const canUpdateSource = !existingProfile.registrationSource || existingProfile.registrationSource === 'organic'

      if (canUpdateSource && isGoogleAds && !isGoogleAdsFromUrl) {
        updateData.registrationSource = 'google_ads'
        console.log('🔄 [AuthCallback/v2] Actualizando registration_source → google_ads')
      } else if (canUpdateSource && isMetaAds) {
        updateData.registrationSource = 'meta'
        console.log('🔄 [AuthCallback/v2] Actualizando registration_source → meta')
      }

      // Guardar registration_url si no existe
      if (!existingProfile.registrationUrl && returnUrl) {
        updateData.registrationUrl = returnUrl
      }

      // Guardar registration_funnel si no existe
      if (!existingProfile.registrationFunnel) {
        if (funnel) {
          updateData.registrationFunnel = funnel
        } else if (oposicion) {
          updateData.registrationFunnel = 'temario_pdf'
        }
      }

      await db
        .update(userProfiles)
        .set(updateData)
        .where(eq(userProfiles.id, userId))

    } else {
      // Perfil no existe — crear nuevo
      console.log('🆕 [AuthCallback/v2] Creando perfil nuevo...')

      let planType = 'free'
      let registrationSource = 'organic'
      let requiresPayment = false

      if (isGoogleAdsFromUrl) {
        planType = 'premium_required'
        registrationSource = 'google_ads'
        requiresPayment = true
      } else if (isGoogleAds) {
        registrationSource = 'google_ads'
      } else if (isMetaAds) {
        registrationSource = 'meta'
      }

      const newProfileData: Record<string, unknown> = {
        id: userId,
        email: userEmail,
        fullName: fullName || userEmail?.split('@')[0],
        avatarUrl: avatarUrl,
        preferredLanguage: 'es',
        planType,
        registrationSource,
        requiresPayment,
        updatedAt: new Date().toISOString(),
      }

      if (oposicion) {
        newProfileData.targetOposicion = oposicion
      }

      if (funnel) {
        newProfileData.registrationFunnel = funnel
      } else if (oposicion) {
        newProfileData.registrationFunnel = 'temario_pdf'
      }

      if (returnUrl) {
        newProfileData.registrationUrl = returnUrl
      }

      await db.insert(userProfiles).values(newProfileData as typeof userProfiles.$inferInsert)
        .onConflictDoUpdate({
          target: userProfiles.id,
          set: {
            fullName: newProfileData.fullName as string,
            avatarUrl: newProfileData.avatarUrl as string | null,
            updatedAt: new Date().toISOString(),
          },
        })
    }

    // 3. Welcome email para usuarios nuevos
    if (isNewUser) {
      console.log('🎉 [AuthCallback/v2] Usuario nuevo — enviando welcome email...')
      try {
        await sendEmailV2({
          userId,
          emailType: 'bienvenida_inmediato',
          customData: {},
        })
      } catch (emailError) {
        console.warn('⚠️ [AuthCallback/v2] Error enviando welcome email:', emailError)
        // No fallar el callback por un email
      }
    }

    // 4. IP de registro (solo si es nuevo o no tiene IP)
    if (isNewUser) {
      try {
        const forwardedFor = request.headers.get('x-forwarded-for')
        const realIp = request.headers.get('x-real-ip')
        const ip = forwardedFor?.split(',')[0]?.trim() ?? realIp ?? 'unknown'

        if (ip !== 'unknown') {
          // Solo guardar si no tiene IP registrada
          const [existing] = await db
            .select({ registrationIp: userProfiles.registrationIp })
            .from(userProfiles)
            .where(eq(userProfiles.id, userId))
            .limit(1)

          if (!existing?.registrationIp) {
            await db
              .update(userProfiles)
              .set({ registrationIp: ip })
              .where(eq(userProfiles.id, userId))
            console.log('📍 [AuthCallback/v2] IP de registro guardada:', ip)
          }
        }
      } catch (ipError) {
        console.warn('⚠️ [AuthCallback/v2] Error guardando IP:', ipError)
      }
    }

    // 5. Determinar redirect URL
    const redirectUrl = returnUrl || '/auxiliar-administrativo-estado'

    console.log('✅ [AuthCallback/v2] Callback procesado:', { userId, isNewUser, redirectUrl })

    return {
      success: true,
      isNewUser,
      redirectUrl,
    }

  } catch (error) {
    console.error('❌ [AuthCallback/v2] Error procesando callback:', error)
    return {
      success: false,
      isNewUser: false,
      redirectUrl: returnUrl || '/auxiliar-administrativo-estado',
      error: error instanceof Error ? error.message : 'Error desconocido',
    }
  }
}
