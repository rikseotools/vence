// app/api/v2/motivational/recent-tests/route.ts
// Tests COMPLETADOS recientes del usuario AUTENTICADO en una ventana de N días
// (MotivationalAnalyzer: checkMinimumActivity con days=7 y getUserAnalyticsData con
// days=14). Devuelve filas completas (el analyzer valida con Zod passthrough).
//
// AGNÓSTICO (Fase C1): sustituye los 2 supabase.from('tests') de cliente del
// MotivationalAnalyzer por Drizzle. El user_id sale SIEMPRE del TOKEN.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/motivational/recent-tests')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const daysParam = Number(new URL(request.url).searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 90 ? Math.floor(daysParam) : 14

  const res = await getAdminDb().execute(sql`
    SELECT *
    FROM tests
    WHERE user_id = ${auth.userId}::uuid
      AND is_completed = true
      AND completed_at >= now() - (${days}::int * interval '1 day')
    ORDER BY completed_at DESC
  `)
  const tests = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []

  return NextResponse.json({ success: true, tests })
}

export const GET = withErrorLogging('/api/v2/motivational/recent-tests', _GET)
