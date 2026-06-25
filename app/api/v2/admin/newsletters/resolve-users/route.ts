// app/api/v2/admin/newsletters/resolve-users/route.ts
// Resuelve una lista de emails → usuarios (id, email, full_name) para el reintento
// de envíos fallidos en /admin/newsletters. Tier admin.
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('user_profiles') de cliente
// (createClient propio) por Drizzle detrás de requireAdmin.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { pgTextArray } from '@/lib/api/sqlArrays'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  emails: z.array(z.string()).min(1).max(10000),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }

  const res = await getAdminDb().execute(sql`
    SELECT id, email, full_name
    FROM user_profiles
    WHERE email = ANY(${pgTextArray(parsed.data.emails)}) AND email IS NOT NULL
  `)
  const users = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []

  return NextResponse.json({ success: true, users })
}

export const POST = withErrorLogging('/api/v2/admin/newsletters/resolve-users', _POST)
