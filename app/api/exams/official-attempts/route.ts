// app/api/exams/official-attempts/route.ts
// Intentos del usuario en un examen oficial concreto (componente
// OfficialExamAttempts). Migrado de supabase.from client-side (PostgREST + RLS)
// → Drizzle server + authz explícita. Desacople PostgREST (Batch D.2).
//
// authz = WHERE user_id = <userId verificado del token> (sustituye a RLS).
// Filtros del examen vía JSONB detailed_analytics->>'...' (igual que antes).

import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb, getPoolerDb } from '@/db/client'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

function getReadDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsOf(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? [])
}

async function _GET(request: NextRequest) {
  const auth = await verifyAuth(request, '/api/exams/official-attempts')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: auth.status ?? 401 })
  }

  const { searchParams } = new URL(request.url)
  const examDate = searchParams.get('examDate') ?? ''
  const parte = searchParams.get('parte') ?? ''
  const oposicion = searchParams.get('oposicion') ?? ''

  try {
    const db = getReadDb()
    const rows = rowsOf(await db.execute(sql`
      SELECT id, title, score, total_questions, completed_at, total_time_seconds
      FROM tests
      WHERE user_id = ${auth.userId}
        AND is_completed = true
        AND test_type = 'exam'
        AND detailed_analytics->>'isOfficialExam' = 'true'
        AND detailed_analytics->>'examDate' = ${examDate}
        AND detailed_analytics->>'parte' = ${parte}
        AND detailed_analytics->>'oposicion' = ${oposicion}
      ORDER BY completed_at DESC
    `))

    const attempts = rows.map(t => ({
      id: t.id,
      title: t.title,
      score: t.score,
      totalQuestions: t.total_questions,
      completedAt: t.completed_at,
      totalTimeSeconds: t.total_time_seconds,
    }))

    return NextResponse.json({ success: true, attempts })
  } catch (error) {
    console.error('❌ [exams/official-attempts] Error:', (error as Error).message)
    return NextResponse.json({ success: false, error: 'Error cargando intentos' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/exams/official-attempts', _GET)
