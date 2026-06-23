// app/api/v2/onboarding/skip/route.ts
// Incrementa el contador de skips del onboarding del usuario AUTENTICADO y sella
// la fecha. Devuelve el nuevo contador (para el log/recordatorio del hook).
//
// AGNÓSTICO (Fase C1): sustituye el SELECT-then-UPDATE supabase.from de cliente
// (PostgREST+RLS) por un UPDATE atómico con RETURNING — además de portable, elimina
// la carrera read-then-write del original. El id sale del TOKEN verificado, NUNCA
// de un prop/body → imposible incrementar el contador de otro usuario.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/onboarding/skip')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  const rows = await getAdminDb().execute(sql`
    UPDATE user_profiles
    SET onboarding_skip_count = COALESCE(onboarding_skip_count, 0) + 1,
        onboarding_last_skip_at = now()
    WHERE id = ${auth.userId}::uuid
    RETURNING onboarding_skip_count AS skip_count
  `)
  const list = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
  const skipCount = (list[0] as { skip_count?: number } | undefined)?.skip_count ?? null

  return NextResponse.json({ success: true, skipCount })
}

export const POST = withErrorLogging('/api/v2/onboarding/skip', _POST)
