// app/api/v2/question-evolution/history/route.ts
// Historial de intentos del usuario sobre UNA pregunta (panel "Tu evolución").
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('test_questions') de cliente
// (PostgREST + RLS) por Drizzle. El user_id sale del TOKEN (verifyAuth), NUNCA del
// cliente → un usuario solo puede leer SU propio historial (la authz que antes
// daba RLS ahora es explícita: WHERE user_id = <token>). withErrorLogging captura
// fallos a observabilidad.
//
// Fechas: to_char ... AT TIME ZONE 'UTC' → ISO con 'T' y 'Z' EXACTO como devolvía
// PostgREST. El cliente hace new Date(...) y .split('T')[0]; un formato con espacio
// (lo que daría ::text sobre timestamptz) rompería el cálculo de días únicos.
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

interface RawRow {
  id: string
  user_answer: string
  correct_answer: string
  is_correct: boolean
  was_blank: boolean
  confidence_level: string | null
  time_spent_seconds: number
  created_at: string
  test_id: string
  question_order: number
  t_id: string | null
  t_title: string | null
  t_completed_at: string | null
  t_created_at: string | null
  t_tema_number: number | null
  t_user_id: string | null
  t_total_questions: number | null
  t_score: string | null
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/question-evolution/history')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const questionId = new URL(request.url).searchParams.get('questionId')
  if (!questionId || !UUID_RE.test(questionId)) {
    return NextResponse.json({ success: false, error: 'invalid_questionId' }, { status: 400 })
  }

  const rows = await db().execute(sql`
    SELECT
      tq.id, tq.user_answer, tq.correct_answer, tq.is_correct, tq.was_blank,
      tq.confidence_level, tq.time_spent_seconds,
      to_char(tq.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      tq.test_id, tq.question_order,
      t.id AS t_id, t.title AS t_title,
      to_char(t.completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS t_completed_at,
      to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS t_created_at,
      t.tema_number AS t_tema_number, t.user_id AS t_user_id,
      t.total_questions AS t_total_questions, t.score AS t_score
    FROM test_questions tq
    LEFT JOIN tests t ON t.id = tq.test_id
    WHERE tq.question_id = ${questionId}::uuid AND tq.user_id = ${auth.userId}::uuid
    ORDER BY tq.created_at ASC
  `)

  const list = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []) as unknown as RawRow[]

  // Reconstruye el embed `tests(...)` de PostgREST como objeto anidado.
  const history = list.map((r) => ({
    id: r.id,
    user_answer: r.user_answer,
    correct_answer: r.correct_answer,
    is_correct: r.is_correct,
    was_blank: r.was_blank,
    confidence_level: r.confidence_level,
    time_spent_seconds: r.time_spent_seconds,
    created_at: r.created_at,
    test_id: r.test_id,
    question_order: r.question_order,
    tests: r.t_id
      ? {
          id: r.t_id,
          title: r.t_title,
          completed_at: r.t_completed_at,
          created_at: r.t_created_at,
          tema_number: r.t_tema_number,
          user_id: r.t_user_id,
          total_questions: r.t_total_questions,
          score: r.t_score,
        }
      : null,
  }))

  return NextResponse.json({ success: true, history })
}

export const GET = withErrorLogging('/api/v2/question-evolution/history', _GET)
