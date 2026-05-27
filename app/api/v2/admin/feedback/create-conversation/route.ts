// app/api/v2/admin/feedback/create-conversation/route.ts
// Crea una feedback_conversation vinculada a un user_feedback existente.
// Reemplaza el INSERT con service_role del componente cliente.
//
// Roadmap: docs/roadmap/agnosticismo-supabase.md — Fase 1.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod/v3'
import { getAdminDb } from '@/db/client'
import { feedbackConversations } from '@/db/schema'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const bodySchema = z.object({
  feedbackId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(['waiting_admin', 'waiting_user', 'open', 'closed']).default('waiting_admin'),
})

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Body inválido: requiere feedbackId (uuid) y userId (uuid)' },
      { status: 400 },
    )
  }

  const db = getAdminDb()
  const now = new Date().toISOString()
  const [conversation] = await db
    .insert(feedbackConversations)
    .values({
      feedbackId: parsed.data.feedbackId,
      userId: parsed.data.userId,
      status: parsed.data.status,
      lastMessageAt: now,
    })
    .returning()

  return NextResponse.json({ success: true, conversation })
}

export const POST = withErrorLogging('/api/v2/admin/feedback/create-conversation', _POST as any)
