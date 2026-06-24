// app/api/v2/daily-question/status/route.ts
// Estado del límite diario de preguntas del usuario AUTENTICADO (useDailyQuestionLimit).
//
// AGNÓSTICO (Fase C1): sustituye supabase.rpc('get_daily_question_status') por la
// MISMA función plpgsql vía Drizzle. p_user_id sale SIEMPRE del TOKEN.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/daily-question/status')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const res = await getAdminDb().execute(sql`SELECT * FROM get_daily_question_status(${auth.userId}::uuid)`)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []

  return NextResponse.json({ success: true, status: rows[0] ?? null })
}

export const GET = withErrorLogging('/api/v2/daily-question/status', _GET)
