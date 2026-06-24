// app/api/v2/conversion-event/route.ts
// Registra un evento de conversión del usuario AUTENTICADO (lib/services/conversionTracker:
// límite alcanzado, modal/botón de upgrade, vista premium, checkout, pago…).
//
// AGNÓSTICO (Fase C1): sustituye supabase.rpc('track_conversion_event') por la MISMA
// función plpgsql vía Drizzle. p_user_id sale SIEMPRE del TOKEN → un cliente no puede
// atribuir conversiones a otro usuario. Best-effort: nunca debe romper el flujo de UI.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  eventType: z.string().min(1).max(120),
  eventData: z.record(z.string(), z.unknown()).nullish(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/conversion-event')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const { eventType, eventData } = parsed.data

  const res = await getAdminDb().execute(sql`
    SELECT track_conversion_event(
      ${auth.userId}::uuid,
      ${eventType},
      ${eventData ? JSON.stringify(eventData) : '{}'}::jsonb
    ) AS id
  `)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  const id = (rows[0] as { id?: string } | undefined)?.id ?? null

  return NextResponse.json({ success: true, id })
}

export const POST = withErrorLogging('/api/v2/conversion-event', _POST)
