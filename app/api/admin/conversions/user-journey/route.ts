// app/api/admin/conversions/user-journey/route.ts
// Devuelve el conversion journey de un user — solo admins.
// Reemplaza el acceso directo desde el browser a `get_user_conversion_journey`
// (era SECURITY DEFINER, invocable por cualquier authenticated → leak de
// journey de cualquier user a cualquier user logueado).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { getAdminDb } from '@/db/client'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const querySchema = z.object({
  userId: z.string().uuid(),
})

function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({ userId: searchParams.get('userId') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'userId UUID requerido' }, { status: 400 })
  }

  // RPC contra RDS vía Drizzle (agnóstico — sin Supabase). La fn no toca auth.users.
  try {
    const res = await getAdminDb().execute(
      sql`SELECT * FROM public.get_user_conversion_journey(${parsed.data.userId}::uuid)`,
    )
    return NextResponse.json({ journey: rowsOf(res) })
  } catch (error) {
    console.error('❌ [admin/conversions/user-journey] DB error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/admin/conversions/user-journey', _GET)
