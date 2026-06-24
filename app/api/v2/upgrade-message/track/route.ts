// app/api/v2/upgrade-message/track/route.ts
// Tracking del ciclo de un mensaje de upgrade (A/B): shown / click / dismiss.
// UpgradeLimitModal. Best-effort.
//
// AGNÓSTICO (Fase C1): sustituye 3 supabase.rpc de cliente (track_upgrade_message_*)
// por las MISMAS funciones plpgsql vía Drizzle. 'shown' usa p_user_id del TOKEN y
// devuelve el impressionId; 'click'/'dismiss' operan por impression_id (igual que el
// original — el id lo obtuvo el propio cliente en 'shown').
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('shown'),
    messageId: z.string().uuid(),
    triggerType: z.string().max(60).default('daily_limit'),
    questionsAnswered: z.number().int().nullish(),
  }),
  z.object({ action: z.literal('click'), impressionId: z.string().uuid() }),
  z.object({ action: z.literal('dismiss'), impressionId: z.string().uuid() }),
])

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/upgrade-message/track')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const b = parsed.data
  const db = getAdminDb()

  if (b.action === 'shown') {
    const res = await db.execute(sql`
      SELECT track_upgrade_message_shown(
        ${auth.userId}::uuid, ${b.messageId}::uuid, ${b.triggerType}, ${b.questionsAnswered ?? null}
      ) AS impression_id
    `)
    const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
    const impressionId = (rows[0] as { impression_id?: string } | undefined)?.impression_id ?? null
    return NextResponse.json({ success: true, impressionId })
  }

  if (b.action === 'click') {
    await db.execute(sql`SELECT track_upgrade_message_click(${b.impressionId}::uuid)`)
  } else {
    await db.execute(sql`SELECT track_upgrade_message_dismiss(${b.impressionId}::uuid)`)
  }
  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/upgrade-message/track', _POST)
