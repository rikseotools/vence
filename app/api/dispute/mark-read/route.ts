// app/api/dispute/mark-read/route.ts
// Marca una impugnación como leída por su dueño.
//
// AGNÓSTICO (05/07): antes usaba `createClient(SERVICE_ROLE)` de Supabase y
// tomaba el `userId` del BODY (hueco C3). Ahora usa Drizzle/RDS y deriva el
// userId del TOKEN → imposible marcar como leída la impugnación de otro usuario.
// El nombre de tabla sale de un ternario fijo (nunca interpolación de input).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { getAdminDb } from '@/db/client'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

async function _POST(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/dispute/mark-read')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  const uid = auth.userId

  const body = await request.json().catch(() => ({}))
  const disputeId = body?.disputeId
  const isPsychometric = Boolean(body?.isPsychometric)

  if (!disputeId) {
    return NextResponse.json(
      { success: false, error: 'disputeId es requerido' },
      { status: 400 },
    )
  }

  try {
    // Ternario con nombres de tabla fijos; el WHERE acota SIEMPRE al token.
    const res = isPsychometric
      ? await getAdminDb().execute(sql`
          UPDATE psychometric_question_disputes SET is_read = true
          WHERE id = ${disputeId}::uuid AND user_id = ${uid}::uuid
          RETURNING id`)
      : await getAdminDb().execute(sql`
          UPDATE question_disputes SET is_read = true
          WHERE id = ${disputeId}::uuid AND user_id = ${uid}::uuid
          RETURNING id`)

    const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Disputa no encontrada' },
        { status: 404 },
      )
    }

    return NextResponse.json({ success: true, disputeId, is_read: true })
  } catch (error) {
    console.error('❌ [dispute/mark-read] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 },
    )
  }
}

export const POST = withErrorLogging('/api/dispute/mark-read', _POST)
