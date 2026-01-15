// lib/api/interactions/queries.ts - Queries tipadas para tracking de interacciones
import { getDb } from '@/db/client'
import { userInteractions } from '@/db/schema'
import { eq, desc, and, gte, sql } from 'drizzle-orm'
import type {
  TrackInteractionRequest,
  TrackBatchInteractionsRequest,
  TrackInteractionResponse
} from './schemas'

// ============================================
// INSERTAR UNA INTERACCIÓN
// ============================================

export async function trackInteraction(
  params: TrackInteractionRequest
): Promise<TrackInteractionResponse> {
  try {
    const db = getDb()

    const [result] = await db
      .insert(userInteractions)
      .values({
        userId: params.userId || null,
        sessionId: params.sessionId || null,
        eventType: params.eventType,
        eventCategory: params.eventCategory,
        component: params.component || null,
        action: params.action || null,
        label: params.label || null,
        value: params.value || {},
        pageUrl: params.pageUrl || null,
        elementId: params.elementId || null,
        elementText: params.elementText || null,
        responseTimeMs: params.responseTimeMs || null,
        deviceInfo: params.deviceInfo || {}
      })
      .returning({ id: userInteractions.id })

    console.log('📊 [Interactions] Evento registrado:', {
      id: result.id,
      type: params.eventType,
      category: params.eventCategory,
      component: params.component
    })

    return {
      success: true,
      eventId: result.id
    }

  } catch (error) {
    console.error('❌ [Interactions] Error registrando evento:', error)
    return {
      success: false
    }
  }
}

// ============================================
// INSERTAR BATCH DE INTERACCIONES
// ============================================

export async function trackBatchInteractions(
  params: TrackBatchInteractionsRequest
): Promise<TrackInteractionResponse> {
  try {
    const db = getDb()

    const values = params.events.map(event => ({
      userId: event.userId || null,
      sessionId: event.sessionId || null,
      eventType: event.eventType,
      eventCategory: event.eventCategory,
      component: event.component || null,
      action: event.action || null,
      label: event.label || null,
      value: event.value || {},
      pageUrl: event.pageUrl || null,
      elementId: event.elementId || null,
      elementText: event.elementText || null,
      responseTimeMs: event.responseTimeMs || null,
      deviceInfo: event.deviceInfo || {}
    }))

    await db.insert(userInteractions).values(values)

    console.log('📊 [Interactions] Batch registrado:', {
      count: params.events.length,
      categories: [...new Set(params.events.map(e => e.eventCategory))]
    })

    return {
      success: true,
      count: params.events.length
    }

  } catch (error) {
    console.error('❌ [Interactions] Error registrando batch:', error)
    return {
      success: false
    }
  }
}

// ============================================
// OBTENER INTERACCIONES POR USUARIO (ADMIN)
// ============================================

export async function getInteractionsByUser(
  userId: string,
  options?: {
    limit?: number
    category?: string
    since?: Date
  }
) {
  try {
    const db = getDb()

    const conditions = [eq(userInteractions.userId, userId)]

    if (options?.category) {
      conditions.push(eq(userInteractions.eventCategory, options.category))
    }

    if (options?.since) {
      conditions.push(gte(userInteractions.createdAt, options.since.toISOString()))
    }

    const results = await db
      .select()
      .from(userInteractions)
      .where(and(...conditions))
      .orderBy(desc(userInteractions.createdAt))
      .limit(options?.limit || 100)

    return results

  } catch (error) {
    console.error('❌ [Interactions] Error obteniendo interacciones:', error)
    return []
  }
}

// ============================================
// OBTENER ESTADÍSTICAS DE INTERACCIONES
// ============================================

export async function getInteractionStats(options?: {
  since?: Date
  userId?: string
}) {
  try {
    const db = getDb()

    const conditions = []

    if (options?.since) {
      conditions.push(gte(userInteractions.createdAt, options.since.toISOString()))
    }

    if (options?.userId) {
      conditions.push(eq(userInteractions.userId, options.userId))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const stats = await db
      .select({
        category: userInteractions.eventCategory,
        count: sql<number>`count(*)::int`
      })
      .from(userInteractions)
      .where(whereClause)
      .groupBy(userInteractions.eventCategory)

    return stats

  } catch (error) {
    console.error('❌ [Interactions] Error obteniendo stats:', error)
    return []
  }
}
