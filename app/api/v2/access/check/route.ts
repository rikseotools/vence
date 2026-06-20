// app/api/v2/access/check/route.ts
// Comprueba el acceso del usuario (premium/free/expirado) en el primer gate.
//
// AGNÓSTICO (Fase A2): invoca la función plpgsql check_user_access vía Drizzle,
// NO supabase.rpc(). El user_id sale del TOKEN (verifyAuth), no del body.
// Devuelve { success, access: { can_access, user_type, message } }.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/access/check')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const db = getAdminDb()
  const rows = await db.execute(sql`SELECT * FROM check_user_access(user_id => ${auth.userId}::uuid)`)
  const results = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
  const access = (results as unknown[])[0] ?? null

  return NextResponse.json({ success: true, access })
}

export const POST = withErrorLogging('/api/v2/access/check', _POST)
