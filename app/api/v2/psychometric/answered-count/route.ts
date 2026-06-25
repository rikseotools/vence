// app/api/v2/psychometric/answered-count/route.ts
// Nº de preguntas (de un conjunto dado) que el usuario AUTENTICADO ya respondió,
// para las estadísticas de categoría de la test-page. user_id del TOKEN.
//
// AGNÓSTICO (Fase C1): sustituye supabase.from('psychometric_test_answers') de cliente.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/psychometric/answered-count')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const questionIds: string[] = (Array.isArray(body?.questionIds) ? body.questionIds : [])
    .filter((id: unknown): id is string => typeof id === 'string' && UUID_RE.test(id))

  if (questionIds.length === 0) {
    return NextResponse.json({ success: true, count: 0 })
  }

  // Lista parametrizada (drizzle hace spread de arrays JS, no los bindea como
  // array Postgres → `${questionIds}::uuid[]` NO funciona).
  const idList = sql.join(questionIds.map((id) => sql`${id}::uuid`), sql`, `)
  const res = await getAdminDb().execute(sql`
    SELECT COUNT(DISTINCT question_id)::int AS n
    FROM psychometric_test_answers
    WHERE user_id = ${auth.userId}::uuid
      AND question_id IN (${idList})
  `)
  const rows = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []) as { n: number }[]

  return NextResponse.json({ success: true, count: rows[0]?.n ?? 0 })
}

export const POST = withErrorLogging('/api/v2/psychometric/answered-count', _POST)
