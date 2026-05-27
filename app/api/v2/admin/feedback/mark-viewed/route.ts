// app/api/v2/admin/feedback/mark-viewed/route.ts
// Marca una feedback_conversations como vista por admin (admin_viewed_at = now()).
// Opcional: cambia el status (típicamente 'waiting_admin' → 'waiting_user').
//
// Reemplaza el path antiguo de app/admin/feedback/page.tsx que usaba
// createClient(url, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) directamente
// desde cliente — fuga del service_role en bundle público.
//
// Roadmap: docs/roadmap/agnosticismo-supabase.md — Fase 1.

import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod/v3'
import { getAdminDb } from '@/db/client'
import { feedbackConversations } from '@/db/schema'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const bodySchema = z.object({
  conversationId: z.string().uuid(),
  status: z.enum(['waiting_admin', 'waiting_user', 'open', 'closed']).optional(),
})

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Body inválido: requiere conversationId (uuid) y opcional status' },
      { status: 400 },
    )
  }

  const db = getAdminDb()
  const updates: { adminViewedAt: string; status?: string } = {
    adminViewedAt: new Date().toISOString(),
  }
  if (parsed.data.status) updates.status = parsed.data.status

  const result = await db
    .update(feedbackConversations)
    .set(updates)
    .where(eq(feedbackConversations.id, parsed.data.conversationId))
    .returning({ id: feedbackConversations.id })

  if (result.length === 0) {
    return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  }

  return NextResponse.json({ success: true, conversationId: result[0].id })
}

export const POST = withErrorLogging('/api/v2/admin/feedback/mark-viewed', _POST as any)
