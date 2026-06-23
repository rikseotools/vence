// app/api/v2/oposicion/target/route.ts
// Devuelve la oposición objetivo del usuario (target_oposicion + datos JSONB).
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('user_profiles') de cliente
// (PostgREST+RLS, OposicionContext) por Drizzle. user_id del TOKEN (verifyAuth),
// nunca del cliente → solo lee TU propia oposición. Solo lectura. target_oposicion_data
// es JSONB → postgres-js lo devuelve ya como objeto (igual que PostgREST).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getDb, getPoolerDb } from '@/db/client'

export const maxDuration = 15

function db() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

interface TargetRow { target_oposicion: string | null; target_oposicion_data: unknown }

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/oposicion/target')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const rows = await db().execute(sql`
    SELECT target_oposicion, target_oposicion_data
    FROM user_profiles
    WHERE id = ${auth.userId}::uuid
    LIMIT 1
  `)
  const arr = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
  const row = (arr[0] ?? null) as TargetRow | null

  return NextResponse.json({
    success: true,
    target_oposicion: row?.target_oposicion ?? null,
    target_oposicion_data: row?.target_oposicion_data ?? null,
  })
}

export const GET = withErrorLogging('/api/v2/oposicion/target', _GET)
