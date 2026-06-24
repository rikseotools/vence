// app/api/v2/motivational-message/route.ts
// Mensaje motivacional personalizado del usuario AUTENTICADO + su reacción previa
// (component MotivationalMessage.fetchMessage).
//
// AGNÓSTICO (Fase C1): sustituye supabase.rpc('get_personalized_message') + el
// SELECT de user_message_interactions de cliente por Drizzle. p_user_id del TOKEN.
// Devuelve message + reaction en una sola llamada (antes eran 2).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/motivational-message')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const url = new URL(request.url)
  const category = url.searchParams.get('category') || 'exam_result'
  let context: Record<string, unknown> = {}
  try {
    const raw = url.searchParams.get('context')
    if (raw) context = JSON.parse(raw)
  } catch { context = {} }

  const db = getAdminDb()
  const msgRes = await db.execute(sql`
    SELECT * FROM get_personalized_message(${auth.userId}::uuid, ${category}, ${JSON.stringify(context)}::jsonb)
  `)
  const message = rowsOf(msgRes)[0] as { message_id?: string } | undefined

  let reaction: string | null = null
  if (message?.message_id) {
    const reactRes = await db.execute(sql`
      SELECT action_type
      FROM user_message_interactions
      WHERE user_id = ${auth.userId}::uuid
        AND message_id = ${message.message_id}::uuid
        AND action_type IN ('love', 'like', 'dislike', 'funny')
      LIMIT 1
    `)
    reaction = (rowsOf(reactRes)[0] as { action_type?: string } | undefined)?.action_type ?? null
  }

  return NextResponse.json({ success: true, message: message ?? null, reaction })
}

export const GET = withErrorLogging('/api/v2/motivational-message', _GET)
