// lib/api/notification-settings/queries.ts - Queries tipadas para configuración de notificaciones
import { getDb } from '@/db/client'
import { userNotificationSettings } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type {
  GetNotificationSettingsRequest,
  GetNotificationSettingsResponse,
  UpsertNotificationSettingsRequest,
  UpsertNotificationSettingsResponse,
  NotificationSettingsData
} from './schemas'

// ============================================
// OBTENER CONFIGURACIÓN DE NOTIFICACIONES POR USER ID
// ============================================

export async function getNotificationSettings(
  params: GetNotificationSettingsRequest
): Promise<GetNotificationSettingsResponse> {
  try {
    const db = getDb()

    const [settings] = await db
      .select({
        id: userNotificationSettings.id,
        userId: userNotificationSettings.userId,
        pushEnabled: userNotificationSettings.pushEnabled,
        pushSubscription: userNotificationSettings.pushSubscription,
        preferredTimes: userNotificationSettings.preferredTimes,
        timezone: userNotificationSettings.timezone,
        frequency: userNotificationSettings.frequency,
        oposicionType: userNotificationSettings.oposicionType,
        examDate: userNotificationSettings.examDate,
        motivationLevel: userNotificationSettings.motivationLevel,
        createdAt: userNotificationSettings.createdAt,
        updatedAt: userNotificationSettings.updatedAt
      })
      .from(userNotificationSettings)
      .where(eq(userNotificationSettings.userId, params.userId))
      .limit(1)

    if (!settings) {
      // Retornar valores por defecto si no existe
      return {
        success: true,
        data: {
          id: '',
          userId: params.userId,
          pushEnabled: false,
          pushSubscription: null,
          preferredTimes: ['09:00', '14:00', '20:00'],
          timezone: 'Europe/Madrid',
          frequency: 'smart',
          oposicionType: 'auxiliar-administrativo',
          examDate: null,
          motivationLevel: 'medium',
          createdAt: null,
          updatedAt: null
        }
      }
    }

    console.log('🔔 [NotificationSettings] Configuración obtenida:', {
      userId: settings.userId,
      pushEnabled: settings.pushEnabled,
      frequency: settings.frequency
    })

    // Cast fields to match schema types
    const data: NotificationSettingsData = {
      id: settings.id,
      userId: settings.userId!,
      pushEnabled: settings.pushEnabled ?? false,
      pushSubscription: (settings.pushSubscription as Record<string, unknown>) ?? null,
      preferredTimes: (settings.preferredTimes as string[]) ?? ['09:00', '14:00', '20:00'],
      timezone: settings.timezone,
      frequency: settings.frequency as NotificationSettingsData['frequency'],
      oposicionType: settings.oposicionType,
      examDate: settings.examDate,
      motivationLevel: settings.motivationLevel as NotificationSettingsData['motivationLevel'],
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt
    }

    return {
      success: true,
      data
    }

  } catch (error) {
    console.error('❌ [NotificationSettings] Error obteniendo configuración:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// ============================================
// UPSERT CONFIGURACIÓN DE NOTIFICACIONES
// ============================================

export async function upsertNotificationSettings(
  params: UpsertNotificationSettingsRequest
): Promise<UpsertNotificationSettingsResponse> {
  try {
    const db = getDb()

    // Construir objeto de actualización
    const updateData: Record<string, unknown> = {
      ...params.data,
      updatedAt: new Date().toISOString()
    }

    // Intentar upsert (insert on conflict update)
    const [result] = await db
      .insert(userNotificationSettings)
      .values({
        userId: params.userId,
        pushEnabled: params.data.pushEnabled ?? false,
        pushSubscription: params.data.pushSubscription ?? null,
        preferredTimes: params.data.preferredTimes ?? ['09:00', '14:00', '20:00'],
        timezone: params.data.timezone ?? 'Europe/Madrid',
        frequency: params.data.frequency ?? 'smart',
        oposicionType: params.data.oposicionType ?? 'auxiliar-administrativo',
        examDate: params.data.examDate ?? null,
        motivationLevel: params.data.motivationLevel ?? 'medium'
      })
      .onConflictDoUpdate({
        target: userNotificationSettings.userId,
        set: updateData
      })
      .returning({
        id: userNotificationSettings.id,
        userId: userNotificationSettings.userId,
        pushEnabled: userNotificationSettings.pushEnabled,
        pushSubscription: userNotificationSettings.pushSubscription,
        preferredTimes: userNotificationSettings.preferredTimes,
        timezone: userNotificationSettings.timezone,
        frequency: userNotificationSettings.frequency,
        oposicionType: userNotificationSettings.oposicionType,
        examDate: userNotificationSettings.examDate,
        motivationLevel: userNotificationSettings.motivationLevel,
        createdAt: userNotificationSettings.createdAt,
        updatedAt: userNotificationSettings.updatedAt
      })

    if (!result) {
      return {
        success: false,
        error: 'No se pudo actualizar la configuración de notificaciones'
      }
    }

    console.log('✅ [NotificationSettings] Configuración actualizada:', {
      userId: result.userId,
      fields: Object.keys(params.data)
    })

    // Cast fields to match schema types
    const data: NotificationSettingsData = {
      id: result.id,
      userId: result.userId!,
      pushEnabled: result.pushEnabled ?? false,
      pushSubscription: (result.pushSubscription as Record<string, unknown>) ?? null,
      preferredTimes: (result.preferredTimes as string[]) ?? ['09:00', '14:00', '20:00'],
      timezone: result.timezone,
      frequency: result.frequency as NotificationSettingsData['frequency'],
      oposicionType: result.oposicionType,
      examDate: result.examDate,
      motivationLevel: result.motivationLevel as NotificationSettingsData['motivationLevel'],
      createdAt: result.createdAt,
      updatedAt: result.updatedAt
    }

    return {
      success: true,
      data
    }

  } catch (error) {
    console.error('❌ [NotificationSettings] Error actualizando configuración:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}
