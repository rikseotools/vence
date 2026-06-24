// app/api/v2/daily-question/increment/route.ts
// Incrementa el contador diario de preguntas del usuario AUTENTICADO y devuelve el
// nuevo estado (useDailyQuestionLimit.recordAnswer).
//
// AGNÓSTICO (Fase C1): sustituye supabase.rpc('increment_daily_questions') por la
// MISMA función plpgsql vía Drizzle. p_user_id sale SIEMPRE del TOKEN → un usuario
// no puede inflar/consumir el límite de otro.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  limit: z.number().int().positive().max(10000).optional(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/daily-question/increment')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const limit = parsed.data.limit ?? 25

  const res = await getAdminDb().execute(sql`SELECT * FROM increment_daily_questions(${auth.userId}::uuid, ${limit})`)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []

  return NextResponse.json({ success: true, status: rows[0] ?? null })
}

export const POST = withErrorLogging('/api/v2/daily-question/increment', _POST)
