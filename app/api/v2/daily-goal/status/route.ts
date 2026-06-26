// app/api/v2/daily-goal/status/route.ts
// Conteo de preguntas respondidas (hoy + opcional semana) para la meta diaria.
//
// AGNÓSTICO (Fase C1): sustituye los 4 COUNT de cliente (supabase PostgREST+RLS,
// hook useDailyGoal) por Drizzle. user_id del TOKEN (verifyAuth), nunca del cliente.
// Las fechas (`today`/`weekAgo`) las calcula el CLIENTE en su tz local y las pasa
// como params → se preserva EXACTO el "hoy"/"semana" del usuario (el server es UTC;
// calcularlo aquí cambiaría el corte de medianoche). Son filtros no sensibles; la
// seguridad la da el user_id del token. La lógica de studyGoal sigue en el cliente
// (usa userProfile). Solo lecturas (COUNT). withErrorLogging captura fallos.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getDb, getPoolerDb } from '@/db/client'

export const maxDuration = 15

function db() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

function firstRow<T>(rows: unknown): T {
  const arr = Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows || []
  return (arr[0] ?? {}) as T
}

interface CountRow { leg: number | null; psycho: number | null }

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/daily-goal/status')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const params = new URL(request.url).searchParams
  const today = params.get('today')
  const weekAgo = params.get('weekAgo')
  if (!today || Number.isNaN(Date.parse(today))) {
    return NextResponse.json({ success: false, error: 'invalid_today' }, { status: 400 })
  }
  const uid = auth.userId

  // "Hoy": cuenta legales (test_questions) + psicotécnicas del día.
  // PERF: usa tq.user_id DIRECTO (no JOIN tests) → el índice idx_tq_user_created_correct
  // (user_id, created_at) sirve el count con index scan (~240ms) en vez del JOIN que
  // spike-aba a 25s en usuarios pesados (48k calls/día → saturación-503). Patrón
  // "JOIN tests eliminado" ya usado en user-answers/theme-stats; tq.user_id es fiable
  // (backfill; paridad verificada). user_answer no vacío; psychometric por user_id.
  const todayRow = firstRow<CountRow>(await db().execute(sql`
    SELECT
      (SELECT count(*)::int FROM test_questions tq
        WHERE tq.user_id = ${uid}::uuid AND tq.created_at >= ${today}::timestamptz AND tq.user_answer <> '') AS leg,
      (SELECT count(*)::int FROM psychometric_test_answers
        WHERE user_id = ${uid}::uuid AND created_at >= ${today}::timestamptz) AS psycho
  `))
  const questionsToday = (todayRow.leg ?? 0) + (todayRow.psycho ?? 0)

  let weekCount: number | null = null
  if (weekAgo && !Number.isNaN(Date.parse(weekAgo))) {
    const weekRow = firstRow<CountRow>(await db().execute(sql`
      SELECT
        (SELECT count(*)::int FROM test_questions tq
          WHERE tq.user_id = ${uid}::uuid AND tq.created_at >= ${weekAgo}::timestamptz
            AND tq.created_at < ${today}::timestamptz AND tq.user_answer <> '') AS leg,
        (SELECT count(*)::int FROM psychometric_test_answers
          WHERE user_id = ${uid}::uuid AND created_at >= ${weekAgo}::timestamptz
            AND created_at < ${today}::timestamptz) AS psycho
    `))
    weekCount = (weekRow.leg ?? 0) + (weekRow.psycho ?? 0)
  }

  return NextResponse.json({ success: true, questionsToday, weekCount })
}

export const GET = withErrorLogging('/api/v2/daily-goal/status', _GET)
