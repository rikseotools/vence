// app/api/v2/studied-topics/route.ts
// Temas (tema_number) que el usuario AUTENTICADO ya ha estudiado (tests completados),
// para "mantener racha" (fetchMantenerRacha). user_id del TOKEN → solo lo propio.
//
// AGNÓSTICO (Fase C1): sustituye supabase.from('tests') de cliente por Drizzle.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/studied-topics')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const res = await getAdminDb().execute(sql`
    SELECT DISTINCT tema_number
    FROM tests
    WHERE user_id = ${auth.userId}::uuid
      AND tema_number IS NOT NULL
      AND is_completed = true
    ORDER BY tema_number
  `)
  const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as { tema_number: number }[]
  const temas = rows
    .map((r) => r.tema_number)
    .filter((n): n is number => typeof n === 'number' && !Number.isNaN(n))

  return NextResponse.json({ success: true, temas })
}

export const GET = withErrorLogging('/api/v2/studied-topics', _GET)
