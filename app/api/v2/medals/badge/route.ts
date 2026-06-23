// app/api/v2/medals/badge/route.ts
// Estado del badge "medallas nuevas": GET lee las medallas guardadas del usuario;
// POST marca como vistas las no vistas.
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('user_medals') SELECT+UPDATE de
// cliente (PostgREST+RLS, hook useNewMedalsBadge) por Drizzle. user_id del TOKEN
// (verifyAuth), nunca del cliente. El POST replica EXACTO el filtro original
// (viewed = false; NO toca filas con viewed NULL — quirk pre-existente, se preserva).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getDb, getPoolerDb } from '@/db/client'

export const maxDuration = 15

function readDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/medals/badge')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  const rows = await readDb().execute(sql`
    SELECT medal_id,
           to_char(unlocked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS unlocked_at,
           viewed
    FROM user_medals
    WHERE user_id = ${auth.userId}::uuid
  `)
  const medals = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
  return NextResponse.json({ success: true, medals })
}

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/medals/badge')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  // Escritura en la primaria (getDb), no en el pooler de lectura.
  await getDb().execute(sql`
    UPDATE user_medals SET viewed = true
    WHERE user_id = ${auth.userId}::uuid AND viewed = false
  `)
  return NextResponse.json({ success: true })
}

export const GET = withErrorLogging('/api/v2/medals/badge', _GET)
export const POST = withErrorLogging('/api/v2/medals/badge', _POST)
