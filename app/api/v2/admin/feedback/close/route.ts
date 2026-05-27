// app/api/v2/admin/feedback/close/route.ts
// Cierra una feedback_conversation (status='closed' + closed_at + last_message_at).
// Opcionalmente marca también el user_feedback asociado como 'resolved'.
// Reemplaza 2 UPDATEs encadenados con service_role en cliente.
//
// Roadmap: docs/roadmap/agnosticismo-supabase.md — Fase 1.

import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'
import { getAdminDb } from '@/db/client'
import { feedbackConversations, userFeedback } from '@/db/schema'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  // Si true, además marca user_feedback.status='resolved' + resolved_at
  alsoResolveFeedback: z.boolean().default(false),
  feedbackId: z.string().uuid().optional(),
})

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Body inválido: requiere conversationId (uuid)' },
      { status: 400 },
    )
  }
  if (parsed.data.alsoResolveFeedback && !parsed.data.feedbackId) {
    return NextResponse.json(
      { error: 'alsoResolveFeedback=true requiere feedbackId' },
      { status: 400 },
    )
  }

  const db = getAdminDb()
  const now = new Date().toISOString()

  const [updated] = await db
    .update(feedbackConversations)
    .set({ status: 'closed', lastMessageAt: now, closedAt: now })
    .where(eq(feedbackConversations.id, parsed.data.conversationId))
    .returning({ id: feedbackConversations.id })

  if (!updated) {
    return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  }

  if (parsed.data.alsoResolveFeedback && parsed.data.feedbackId) {
    await db
      .update(userFeedback)
      .set({ status: 'resolved', resolvedAt: now })
      .where(eq(userFeedback.id, parsed.data.feedbackId))
  }

  return NextResponse.json({
    success: true,
    conversationId: updated.id,
    feedbackResolved: parsed.data.alsoResolveFeedback,
  })
}

export const POST = withErrorLogging('/api/v2/admin/feedback/close', _POST as any)
