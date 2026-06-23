// app/api/v2/psychometric-evolution/history/route.ts
// Historial de intentos del usuario sobre UNA pregunta psicotécnica.
//
// AGNÓSTICO (Fase C1, gemelo de question-evolution/history): sustituye el
// supabase.from('psychometric_test_answers') de cliente (PostgREST+RLS) por
// Drizzle. user_id del TOKEN (verifyAuth), nunca del cliente → authz explícita
// (la que daba RLS). Sin embed (la query original solo trae 7 columnas base).
// created_at vía to_char AT TIME ZONE 'UTC' → ISO con 'T'/'Z' EXACTO (el cliente
// hace new Date(...) y .split('T')[0]). withErrorLogging captura fallos.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getDb, getPoolerDb } from '@/db/client'

export const maxDuration = 15

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function db() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/psychometric-evolution/history')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const questionId = new URL(request.url).searchParams.get('questionId')
  if (!questionId || !UUID_RE.test(questionId)) {
    return NextResponse.json({ success: false, error: 'invalid_questionId' }, { status: 400 })
  }

  const rows = await db().execute(sql`
    SELECT id, user_answer, is_correct, time_spent_seconds,
           to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
           test_session_id, question_order
    FROM psychometric_test_answers
    WHERE question_id = ${questionId}::uuid AND user_id = ${auth.userId}::uuid
    ORDER BY created_at ASC
  `)

  const history = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
  return NextResponse.json({ success: true, history })
}

export const GET = withErrorLogging('/api/v2/psychometric-evolution/history', _GET)
