// lib/adminConversationTracking.ts - Sistema de tracking de conversaciones vistas por admin
// Módulo SERVER-ONLY (llamado desde app/api/admin/mark-*). Migrado a Drizzle
// (getAdminDb) — agnóstico de Supabase REST. El antiguo factory cliente
// `createClientConversationTracker` se eliminó por dead-code (0 callers).
import { getAdminDb } from '@/db/client'
import { feedbackConversations, feedbackMessages } from '@/db/schema'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'

interface TrackingResult {
  success: boolean
  error?: string
}

interface CountResult extends TrackingResult {
  count: number
}

export async function markConversationAsViewed(conversationId: string): Promise<TrackingResult> {
  try {
    await getAdminDb()
      .update(feedbackConversations)
      .set({ adminViewedAt: new Date().toISOString() })
      .where(and(
        eq(feedbackConversations.id, conversationId),
        isNull(feedbackConversations.adminViewedAt)
      ))

    console.log(`✅ Conversación ${conversationId} marcada como vista`)
    return { success: true }

  } catch (error) {
    console.error('❌ Error marcando conversación como vista:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function markConversationsAsViewed(conversationIds: string[]): Promise<TrackingResult> {
  try {
    await getAdminDb()
      .update(feedbackConversations)
      .set({ adminViewedAt: new Date().toISOString() })
      .where(and(
        inArray(feedbackConversations.id, conversationIds),
        isNull(feedbackConversations.adminViewedAt)
      ))

    console.log(`✅ ${conversationIds.length} conversaciones marcadas como vistas`)
    return { success: true }

  } catch (error) {
    console.error('❌ Error marcando conversaciones como vistas:', error)
    return { success: false, error: (error as Error).message }
  }
}

export async function getUnviewedConversationsCount(): Promise<CountResult> {
  try {
    const rows = await getAdminDb()
      .select({ total: sql<number>`(count(*))::int` })
      .from(feedbackConversations)
      .where(and(
        eq(feedbackConversations.status, 'open'),
        isNull(feedbackConversations.adminViewedAt)
      ))

    return { success: true, count: rows[0]?.total ?? 0 }

  } catch (error) {
    console.error('❌ Error obteniendo conversaciones no vistas:', error)
    return { success: false, count: 0, error: (error as Error).message }
  }
}

export async function markMessagesAsRead(conversationId: string): Promise<TrackingResult> {
  try {
    await getAdminDb()
      .update(feedbackMessages)
      .set({ readAt: new Date().toISOString() })
      .where(and(
        eq(feedbackMessages.conversationId, conversationId),
        eq(feedbackMessages.isAdmin, false),
        isNull(feedbackMessages.readAt)
      ))

    console.log(`✅ Mensajes de conversación ${conversationId} marcados como leídos`)
    return { success: true }

  } catch (error) {
    console.error('❌ Error marcando mensajes como leídos:', error)
    return { success: false, error: (error as Error).message }
  }
}
