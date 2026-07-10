// app/api/admin/users/subscriptions/route.ts
// Devuelve la lista de users con sus subscripciones — solo admins.
// Reemplaza el acceso directo desde el browser a la RPC
// `get_all_users_with_subscriptions` (que era SECURITY DEFINER y por
// tanto invocable por cualquier user authenticated, exponiendo emails y
// estado de subscripción de TODOS los users).

import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  // RPC contra RDS vía Drizzle (agnóstico — sin Supabase). La fn no toca auth.users.
  try {
    const res = await getAdminDb().execute(sql`SELECT * FROM public.get_all_users_with_subscriptions()`)
    return NextResponse.json({ users: rowsOf(res) })
  } catch (error) {
    console.error('❌ [admin/users/subscriptions] DB error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/admin/users/subscriptions', _GET)
