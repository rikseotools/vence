// app/api/v2/upgrade-message/route.ts
// Mensaje de upgrade (A/B testing) para el usuario AUTENTICADO (UpgradeLimitModal).
//
// AGNÓSTICO (Fase C1): sustituye supabase.rpc('get_random_upgrade_message') por la
// MISMA función plpgsql vía Drizzle. p_user_id del TOKEN.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/upgrade-message')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const res = await getAdminDb().execute(sql`SELECT * FROM get_random_upgrade_message(${auth.userId}::uuid)`)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []

  return NextResponse.json({ success: true, message: rows[0] ?? null })
}

export const GET = withErrorLogging('/api/v2/upgrade-message', _GET)
