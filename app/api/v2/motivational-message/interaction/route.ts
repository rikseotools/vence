// app/api/v2/motivational-message/interaction/route.ts
// Registra una interacción con un mensaje motivacional del usuario AUTENTICADO
// (view / love / like / dislike / funny / unreact / share) — MotivationalMessage.trackInteraction.
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('user_message_interactions').insert
// de cliente por Drizzle. user_id SIEMPRE del TOKEN. ON CONFLICT DO NOTHING preserva
// el comportamiento del original (duplicado 23505 = no-op, no error).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  messageId: z.string().uuid(),
  actionType: z.string().min(1).max(40),
  shownIn: z.string().max(120).nullish(),
  messageText: z.string().nullish(),
  sharePlatform: z.string().max(60).nullish(),
  deviceInfo: z.record(z.string(), z.unknown()).nullish(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/motivational-message/interaction')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const b = parsed.data

  await getAdminDb().execute(sql`
    INSERT INTO user_message_interactions
      (user_id, message_id, action_type, shown_in, message_text, share_platform, device_info)
    VALUES (
      ${auth.userId}::uuid, ${b.messageId}::uuid, ${b.actionType}, ${b.shownIn ?? null},
      ${b.messageText ?? null}, ${b.sharePlatform ?? null},
      ${b.deviceInfo ? JSON.stringify(b.deviceInfo) : null}::jsonb
    )
    ON CONFLICT DO NOTHING
  `)

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/motivational-message/interaction', _POST)
