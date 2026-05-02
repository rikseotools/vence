// app/api/admin/conversions/user-journey/route.ts
// Devuelve el conversion journey de un user — solo admins.
// Reemplaza el acceso directo desde el browser a `get_user_conversion_journey`
// (era SECURITY DEFINER, invocable por cualquier authenticated → leak de
// journey de cualquier user a cualquier user logueado).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const querySchema = z.object({
  userId: z.string().uuid(),
})

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ userId: searchParams.get('userId') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'userId UUID requerido' }, { status: 400 })
  }

  const { data, error } = await admin.supabase.rpc('get_user_conversion_journey', {
    p_user_id: parsed.data.userId,
  })
  if (error) {
    console.error('❌ [admin/conversions/user-journey] DB error:', error.message)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
  return NextResponse.json({ journey: data ?? [] })
}

export const GET = withErrorLogging('/api/admin/conversions/user-journey', _GET)
