// lib/api/close-inactive-feedback/queries.ts
// Queries tipadas para cerrar feedback inactivos usando Drizzle
import { getDb } from '@/db/client'
import { feedbackConversations, feedbackMessages } from '@/db/schema'
import { eq, lt, desc, and } from 'drizzle-orm'
import {
  DAYS_WAITING_USER,
  DAYS_OPEN_INACTIVE,
  DAYS_WAITING_ADMIN,
  type ClosedCounts,
  type ConversationToCheck,
  type LastMessage,
} from './schemas'

// ============================================
// HELPERS
// ============================================

function getCutoffDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene conversaciones en waiting_user que podrían cerrarse
 */
export async function getWaitingUserConversations(
  cutoffDate: Date
): Promise<ConversationToCheck[]> {
  const db = getDb()

  const results = await db
    .select({
      id: feedbackConversations.id,
      userId: feedbackConversations.userId,
      createdAt: feedbackConversations.createdAt,
    })
    .from(feedbackConversations)
    .where(
      and(
        eq(feedbackConversations.status, 'waiting_user'),
        lt(feedbackConversations.createdAt, cutoffDate.toISOString())
      )
    )

  return results
}

/**
 * Obtiene conversaciones en open sin actividad
 */
export async function getOpenInactiveConversations(
  cutoffDate: Date
): Promise<ConversationToCheck[]> {
  const db = getDb()

  const results = await db
    .select({
      id: feedbackConversations.id,
      userId: feedbackConversations.userId,
      createdAt: feedbackConversations.createdAt,
    })
    .from(feedbackConversations)
    .where(
      and(
        eq(feedbackConversations.status, 'open'),
        lt(feedbackConversations.createdAt, cutoffDate.toISOString())
      )
    )

  return results
}

/**
 * Obtiene el último mensaje de una conversación
 */
export async function getLastMessage(
  conversationId: string
): Promise<LastMessage | null> {
  const db = getDb()

  const results = await db
    .select({
      isAdmin: feedbackMessages.isAdmin,
      createdAt: feedbackMessages.createdAt,
    })
    .from(feedbackMessages)
    .where(eq(feedbackMessages.conversationId, conversationId))
    .orderBy(desc(feedbackMessages.createdAt))
    .limit(1)

  return results[0] || null
}

/**
 * Cierra una conversación específica
 */
export async function closeConversation(conversationId: string): Promise<void> {
  const db = getDb()

  await db
    .update(feedbackConversations)
    .set({
      status: 'closed',
      closedAt: new Date().toISOString(),
    })
    .where(eq(feedbackConversations.id, conversationId))
}

/**
 * Cierra conversaciones waiting_admin muy antiguas
 * Retorna el número de conversaciones cerradas
 */
export async function closeVeryOldWaitingAdmin(
  cutoffDate: Date
): Promise<number> {
  const db = getDb()

  const results = await db
    .update(feedbackConversations)
    .set({
      status: 'closed',
      closedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(feedbackConversations.status, 'waiting_admin'),
        lt(feedbackConversations.createdAt, cutoffDate.toISOString())
      )
    )
    .returning({ id: feedbackConversations.id })

  return results.length
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Ejecuta el proceso completo de cierre de feedback inactivos
 */
export async function closeInactiveFeedback(): Promise<ClosedCounts> {
  const now = new Date()
  const cutoffWaitingUser = getCutoffDate(DAYS_WAITING_USER)
  const cutoffOpenInactive = getCutoffDate(DAYS_OPEN_INACTIVE)
  const cutoff30Days = getCutoffDate(DAYS_WAITING_ADMIN)

  console.log('🔄 Cerrando feedback inactivos...')
  console.log(`   - waiting_user > ${DAYS_WAITING_USER} días (antes de ${cutoffWaitingUser.toISOString().substring(0, 10)})`)
  console.log(`   - open > ${DAYS_OPEN_INACTIVE} días (antes de ${cutoffOpenInactive.toISOString().substring(0, 10)})`)

  // 1. Cerrar conversaciones en waiting_user sin respuesta del usuario
  const waitingUserConvs = await getWaitingUserConversations(cutoffWaitingUser)
  let closedWaitingUser = 0

  for (const conv of waitingUserConvs) {
    const lastMsg = await getLastMessage(conv.id)

    // Solo cerrar si el último mensaje fue del admin hace más de X días
    if (lastMsg?.isAdmin && lastMsg.createdAt) {
      const lastMsgDate = new Date(lastMsg.createdAt)
      if (lastMsgDate < cutoffWaitingUser) {
        await closeConversation(conv.id)
        closedWaitingUser++
      }
    }
  }

  // 2. Cerrar conversaciones en open sin actividad
  const openConvs = await getOpenInactiveConversations(cutoffOpenInactive)
  let closedOpen = 0

  for (const conv of openConvs) {
    const lastMsg = await getLastMessage(conv.id)
    const lastActivity = lastMsg?.createdAt || conv.createdAt

    if (lastActivity && new Date(lastActivity) < cutoffOpenInactive) {
      await closeConversation(conv.id)
      closedOpen++
    }
  }

  // 3. Cerrar waiting_admin muy antiguos (más de 30 días)
  const closedVeryOld = await closeVeryOldWaitingAdmin(cutoff30Days)

  const totalClosed = closedWaitingUser + closedOpen + closedVeryOld

  console.log(`✅ Cerradas ${totalClosed} conversaciones:`)
  console.log(`   - waiting_user: ${closedWaitingUser}`)
  console.log(`   - open: ${closedOpen}`)
  console.log(`   - waiting_admin (>${DAYS_WAITING_ADMIN}d): ${closedVeryOld}`)

  return {
    waiting_user: closedWaitingUser,
    open: closedOpen,
    waiting_admin_old: closedVeryOld,
    total: totalClosed,
  }
}
