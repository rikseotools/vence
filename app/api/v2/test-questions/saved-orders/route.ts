// app/api/v2/test-questions/saved-orders/route.ts
// Devuelve los question_order ya guardados de un test (TestLayout.saveAnswersInBackground
// los usa para deduplicar antes de reintentar el guardado de respuestas).
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('test_questions') de cliente por
// Drizzle. SEGURIDAD: el JOIN con tests + WHERE t.user_id = TOKEN garantiza que el
// usuario solo ve los orders de SUS tests (replica la RLS de test_questions/tests).
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/test-questions/saved-orders')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const testId = new URL(request.url).searchParams.get('testId')
  if (!testId) {
    return NextResponse.json({ success: false, error: 'missing_testId' }, { status: 400 })
  }

  const res = await getAdminDb().execute(sql`
    SELECT tq.question_order
    FROM test_questions tq
    JOIN tests t ON t.id = tq.test_id
    WHERE tq.test_id = ${testId}::uuid
      AND t.user_id = ${auth.userId}::uuid
  `)
  const rows = Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
  const orders = rows.map(r => (r as { question_order: number }).question_order)

  return NextResponse.json({ success: true, orders })
}

export const GET = withErrorLogging('/api/v2/test-questions/saved-orders', _GET)
