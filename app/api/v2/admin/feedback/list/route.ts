// app/api/v2/admin/feedback/list/route.ts
// Lista TODAS las feedback_conversations con su feedback y mensajes resumidos.
// Reemplaza un SELECT nested con joins desde createClient(.., service_role)
// en cliente. Usado por loadConversations() del componente admin.
//
// Roadmap: docs/roadmap/agnosticismo-supabase.md — Fase 1.

import { NextResponse, type NextRequest } from 'next/server'
import { desc, eq, inArray } from 'drizzle-orm'
import { getAdminDb } from '@/db/client'
import { feedbackConversations, userFeedback, feedbackMessages } from '@/db/schema'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const db = getAdminDb()

  // 1) Conversaciones ordenadas por last_message_at desc
  const conversations = await db
    .select()
    .from(feedbackConversations)
    .orderBy(desc(feedbackConversations.lastMessageAt))

  if (conversations.length === 0) {
    return NextResponse.json({ success: true, conversations: [] })
  }

  // 2) Feedbacks asociados (en batch por feedback_id IN (...))
  const feedbackIds = [...new Set(conversations.map((c) => c.feedbackId).filter(Boolean) as string[])]
  const conversationIds = conversations.map((c) => c.id)

  const [feedbacks, messages] = await Promise.all([
    feedbackIds.length > 0
      ? db.select().from(userFeedback).where(inArray(userFeedback.id, feedbackIds))
      : Promise.resolve([]),
    db
      .select({
        id: feedbackMessages.id,
        conversationId: feedbackMessages.conversationId,
        isAdmin: feedbackMessages.isAdmin,
        createdAt: feedbackMessages.createdAt,
        message: feedbackMessages.message,
      })
      .from(feedbackMessages)
      .where(inArray(feedbackMessages.conversationId, conversationIds)),
  ])

  // 3) Agrupar mensajes por conversationId
  const messagesByConv = new Map<string, typeof messages>()
  for (const m of messages) {
    if (!m.conversationId) continue
    if (!messagesByConv.has(m.conversationId)) messagesByConv.set(m.conversationId, [])
    messagesByConv.get(m.conversationId)!.push(m)
  }
  // 4) Indexar feedbacks por id
  const feedbackById = new Map(feedbacks.map((f) => [f.id, f]))

  // 5) Componer respuesta — nombres snake_case para compatibilidad con el componente
  const enriched = conversations.map((c) => ({
    ...c,
    feedback_id: c.feedbackId,
    user_id: c.userId,
    admin_user_id: c.adminUserId,
    last_message_at: c.lastMessageAt,
    admin_viewed_at: c.adminViewedAt,
    closed_at: c.closedAt,
    created_at: c.createdAt,
    feedback: c.feedbackId ? feedbackById.get(c.feedbackId) ?? null : null,
    feedback_messages: (messagesByConv.get(c.id) ?? []).map((m) => ({
      id: m.id,
      is_admin: m.isAdmin,
      created_at: m.createdAt,
      message: m.message,
    })),
  }))

  return NextResponse.json({ success: true, conversations: enriched })
}

export const GET = withErrorLogging('/api/v2/admin/feedback/list', _GET as any)
