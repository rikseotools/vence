// app/api/admin/users/subscriptions/route.ts
// Devuelve la lista de users con sus subscripciones — solo admins.
// Reemplaza el acceso directo desde el browser a la RPC
// `get_all_users_with_subscriptions` (que era SECURITY DEFINER y por
// tanto invocable por cualquier user authenticated, exponiendo emails y
// estado de subscripción de TODOS los users).

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const { data, error } = await admin.supabase.rpc('get_all_users_with_subscriptions')
  if (error) {
    console.error('❌ [admin/users/subscriptions] DB error:', error.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  return NextResponse.json({ users: data ?? [] })
}

export const GET = withErrorLogging('/api/admin/users/subscriptions', _GET)
