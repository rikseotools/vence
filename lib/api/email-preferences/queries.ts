// lib/api/email-preferences/queries.ts - Queries tipadas para preferencias de email
import { getDb } from '@/db/client'
import { emailPreferences } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type {
  GetEmailPreferencesRequest,
  GetEmailPreferencesResponse,
  UpsertEmailPreferencesRequest,
  UpsertEmailPreferencesResponse,
  EmailPreferencesData
} from './schemas'

// ============================================
// OBTENER PREFERENCIAS DE EMAIL POR USER ID
// ============================================

export async function getEmailPreferences(
  params: GetEmailPreferencesRequest
): Promise<GetEmailPreferencesResponse> {
  try {
    const db = getDb()

    const [prefs] = await db
      .select({
        id: emailPreferences.id,
        userId: emailPreferences.userId,
        emailReactivacion: emailPreferences.emailReactivacion,
        emailUrgente: emailPreferences.emailUrgente,
        emailBienvenidaMotivacional: emailPreferences.emailBienvenidaMotivacional,
        emailBienvenidaInmediato: emailPreferences.emailBienvenidaInmediato,
        emailResumenSemanal: emailPreferences.emailResumenSemanal,
        unsubscribedAll: emailPreferences.unsubscribedAll,
        unsubscribedAt: emailPreferences.unsubscribedAt,
        createdAt: emailPreferences.createdAt,
        updatedAt: emailPreferences.updatedAt
      })
      .from(emailPreferences)
      .where(eq(emailPreferences.userId, params.userId))
      .limit(1)

    if (!prefs) {
      // Retornar valores por defecto si no existe
      return {
        success: true,
        data: {
          id: '',
          userId: params.userId,
          emailReactivacion: true,
          emailUrgente: true,
          emailBienvenidaMotivacional: true,
          emailBienvenidaInmediato: true,
          emailResumenSemanal: true,
          unsubscribedAll: false,
          unsubscribedAt: null,
          createdAt: null,
          updatedAt: null
        }
      }
    }

    console.log('📧 [EmailPreferences] Preferencias obtenidas:', {
      userId: prefs.userId,
      unsubscribedAll: prefs.unsubscribedAll
    })

    return {
      success: true,
      data: prefs as EmailPreferencesData
    }

  } catch (error) {
    console.error('❌ [EmailPreferences] Error obteniendo preferencias:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// UPSERT PREFERENCIAS DE EMAIL
// ============================================

export async function upsertEmailPreferences(
  params: UpsertEmailPreferencesRequest
): Promise<UpsertEmailPreferencesResponse> {
  try {
    const db = getDb()

    // Construir objeto de actualización
    const updateData: Record<string, unknown> = {
      ...params.data,
      updatedAt: new Date().toISOString()
    }

    // Si se desuscribe de todo, registrar la fecha
    if (params.data.unsubscribedAll === true) {
      updateData.unsubscribedAt = new Date().toISOString()
    } else if (params.data.unsubscribedAll === false) {
      updateData.unsubscribedAt = null
    }

    // Intentar upsert (insert on conflict update)
    const [result] = await db
      .insert(emailPreferences)
      .values({
        userId: params.userId,
        emailReactivacion: params.data.emailReactivacion ?? true,
        emailUrgente: params.data.emailUrgente ?? true,
        emailBienvenidaMotivacional: params.data.emailBienvenidaMotivacional ?? true,
        emailBienvenidaInmediato: params.data.emailBienvenidaInmediato ?? true,
        emailResumenSemanal: params.data.emailResumenSemanal ?? true,
        unsubscribedAll: params.data.unsubscribedAll ?? false,
        unsubscribedAt: params.data.unsubscribedAll === true ? new Date().toISOString() : null
      })
      .onConflictDoUpdate({
        target: emailPreferences.userId,
        set: updateData
      })
      .returning({
        id: emailPreferences.id,
        userId: emailPreferences.userId,
        emailReactivacion: emailPreferences.emailReactivacion,
        emailUrgente: emailPreferences.emailUrgente,
        emailBienvenidaMotivacional: emailPreferences.emailBienvenidaMotivacional,
        emailBienvenidaInmediato: emailPreferences.emailBienvenidaInmediato,
        emailResumenSemanal: emailPreferences.emailResumenSemanal,
        unsubscribedAll: emailPreferences.unsubscribedAll,
        unsubscribedAt: emailPreferences.unsubscribedAt,
        createdAt: emailPreferences.createdAt,
        updatedAt: emailPreferences.updatedAt
      })

    if (!result) {
      return {
        success: false,
        error: 'No se pudo actualizar las preferencias de email'
      }
    }

    console.log('✅ [EmailPreferences] Preferencias actualizadas:', {
      userId: result.userId,
      fields: Object.keys(params.data)
    })

    return {
      success: true,
      data: result as EmailPreferencesData
    }

  } catch (error) {
    console.error('❌ [EmailPreferences] Error actualizando preferencias:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}
