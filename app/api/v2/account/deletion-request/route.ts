// app/api/v2/account/deletion-request/route.ts
// Solicitud de eliminación de cuenta del usuario AUTENTICADO (se materializa como
// una fila en user_feedback con type='account_deletion', status='pending').
//
//   GET  → { pending: boolean }  (¿hay ya una solicitud pendiente?)
//   POST → { pending: true }     (crea la solicitud; IDEMPOTENTE: si ya existe una
//          pendiente, no duplica — el dedup-check + INSERT se hacen server-side)
//
// AGNÓSTICO (Fase C1): sustituye los supabase.from('user_feedback') de cliente
// (PostgREST+RLS) por Drizzle. El user_id sale SIEMPRE del TOKEN verificado, nunca
// de prop/body → imposible solicitar la eliminación de la cuenta de otro usuario.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/account/deletion-request')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const res = await getAdminDb().execute(sql`
    SELECT 1
    FROM user_feedback
    WHERE user_id = ${auth.userId}::uuid
      AND type = 'account_deletion'
      AND status = 'pending'
    LIMIT 1
  `)
  return NextResponse.json({ success: true, pending: rowsOf(res).length > 0 })
}

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/account/deletion-request')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  // Inserta solo si NO existe ya una solicitud pendiente (idempotente, sin carrera
  // check-then-insert del cliente original). Devuelve pending=true en ambos casos.
  await getAdminDb().execute(sql`
    INSERT INTO user_feedback (user_id, message, type, status, url)
    SELECT ${auth.userId}::uuid, '[Solicitud de eliminación de cuenta desde perfil]',
           'account_deletion', 'pending', '/perfil'
    WHERE NOT EXISTS (
      SELECT 1 FROM user_feedback
      WHERE user_id = ${auth.userId}::uuid
        AND type = 'account_deletion'
        AND status = 'pending'
    )
  `)
  return NextResponse.json({ success: true, pending: true })
}

export const GET = withErrorLogging('/api/v2/account/deletion-request', _GET)
export const POST = withErrorLogging('/api/v2/account/deletion-request', _POST)
