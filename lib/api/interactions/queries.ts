// lib/api/interactions/queries.ts - Queries tipadas para tracking de interacciones
// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getInteractionsDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
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
    const db = getInteractionsDb()

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
        deviceInfo: params.deviceInfo || {},
        deployVersion: params.deployVersion || null
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
    // FK violation (user_id no existe en users): browser zombie de un usuario
    // ya eliminado por admin-delete-user. No es bug — es esperado. Devolver
    // success:true para que el browser deje de reintentar y no contaminar logs.
    const pgCode = (error as { code?: string; cause?: { code?: string } })?.code
                || (error as { cause?: { code?: string } })?.cause?.code
    if (pgCode === '23503') {
      console.info('🧟 [Interactions] FK violation (zombie session de user eliminado), ignorado')
      return { success: true }
    }
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
    const db = getInteractionsDb()

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
      deviceInfo: event.deviceInfo || {},
      deployVersion: event.deployVersion || null
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
    // Mismo caso que trackInteraction: FK violation = zombie session de user eliminado.
    const pgCode = (error as { code?: string; cause?: { code?: string } })?.code
                || (error as { cause?: { code?: string } })?.cause?.code
    if (pgCode === '23503') {
      console.info('🧟 [Interactions] FK violation batch (zombie session de user eliminado), ignorado')
      return { success: true, count: params.events.length }
    }
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
    const db = getInteractionsDb()

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
    const db = getInteractionsDb()

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
