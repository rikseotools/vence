// app/api/v2/admin/feedback/create-admin-conversation/route.ts
// Crea user_feedback + feedback_conversation iniciada por admin.
// Reemplaza 2 INSERTs encadenados con service_role en cliente.
//
// Patrón post-14/04/2026 documentado en el componente: feedback se crea con
// status='in_progress' priority='high'. La conversación
// queda 'open' hasta que se llame al endpoint de respuesta (que cierra a
// 'resolved'). El INSERT del mensaje + envío de email es responsabilidad
// del caller via /api/feedback/respond-via-endpoint — este endpoint solo
// crea los 2 registros base.
//
// Roadmap: docs/roadmap/agnosticismo-supabase.md — Fase 1.

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod/v3'
import { getAdminDb } from '@/db/client'
import { userFeedback, feedbackConversations } from '@/db/schema'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const bodySchema = z.object({
  targetUserId: z.string().uuid(),
  targetEmail: z.string().email(),
  messagePreview: z.string().min(1).max(120),
  feedbackType: z.string().default('other'),
  url: z.string().default('https://vence.es/'),
})

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Body inválido: requiere targetUserId, targetEmail, messagePreview' },
      { status: 400 },
    )
  }

  const db = getAdminDb()
  const now = new Date().toISOString()

  // 1. Crear feedback inicial
  const [feedback] = await db
    .insert(userFeedback)
    .values({
      userId: parsed.data.targetUserId,
      email: parsed.data.targetEmail,
      type: parsed.data.feedbackType,
      message: parsed.data.messagePreview,
      url: parsed.data.url,
      status: 'in_progress',
      priority: 'high',
    })
    .returning()

  // 2. Crear conversación vinculada (admin_user_id es el admin que está creando)
  const [conversation] = await db
    .insert(feedbackConversations)
    .values({
      feedbackId: feedback.id,
      userId: parsed.data.targetUserId,
      adminUserId: auth.user.id,
      status: 'open',
      lastMessageAt: now,
    })
    .returning()

  return NextResponse.json({ success: true, feedback, conversation })
}

export const POST = withErrorLogging('/api/v2/admin/feedback/create-admin-conversation', _POST as any)
