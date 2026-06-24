// app/api/v2/streak/route.ts
// Racha actual (current_streak) del usuario AUTENTICADO (Header).
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('user_streaks').select de
// cliente por Drizzle. El user_id sale SIEMPRE del TOKEN → imposible leer la
// racha de otro usuario. maybeSingle → 0 si no hay fila (usuario nuevo).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/streak')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const res = await getAdminDb().execute(sql`
    SELECT current_streak
    FROM user_streaks
    WHERE user_id = ${auth.userId}::uuid
    LIMIT 1
  `)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  const currentStreak = (rows[0] as { current_streak?: number } | undefined)?.current_streak ?? 0

  return NextResponse.json({ success: true, currentStreak })
}

export const GET = withErrorLogging('/api/v2/streak', _GET)
