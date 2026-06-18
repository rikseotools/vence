// app/api/disputes/mine/route.ts
// Lista las impugnaciones del usuario autenticado (su página /mis-impugnaciones).
// Migrado de supabase.from client-side (PostgREST + RLS) → Drizzle server + authz
// explícita (WHERE user_id = <userId verificado del token>). Desacople PostgREST.
//
// La authz la pone el WHERE user_id derivado de verifyAuth (NO de un id que mande
// el cliente) — sustituye a lo que hacía RLS con auth.uid().

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
  const auth = await verifyAuth(request, '/api/disputes/mine')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'No autenticado' }, { status: auth.status ?? 401 })
  }

  try {
    const db = getReadDb()

    // INNER joins (igual que el `!inner` de la query PostgREST anterior):
    // impugnaciones cuyo artículo/ley ya no existen quedan excluidas, como antes.
    const rows = rowsOf(await db.execute(sql`
      SELECT qd.id, qd.dispute_type, qd.description, qd.status, qd.created_at,
             qd.resolved_at, qd.admin_response, qd.appeal_text, qd.appeal_submitted_at,
             q.question_text, q.correct_option,
             q.option_a, q.option_b, q.option_c, q.option_d,
             a.article_number, a.title AS article_title,
             l.short_name AS law_short_name
      FROM question_disputes qd
      JOIN questions q ON q.id = qd.question_id
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
      WHERE qd.user_id = ${auth.userId}
      ORDER BY qd.created_at DESC
    `))

    // Reshape al mismo árbol anidado que esperaba el componente (questions →
    // articles → laws), para no tocar el render.
    const disputes = rows.map(r => ({
      id: r.id,
      dispute_type: r.dispute_type,
      description: r.description,
      status: r.status,
      created_at: r.created_at,
      resolved_at: r.resolved_at,
      admin_response: r.admin_response,
      appeal_text: r.appeal_text,
      appeal_submitted_at: r.appeal_submitted_at,
      questions: {
        question_text: r.question_text,
        correct_option: r.correct_option,
        option_a: r.option_a,
        option_b: r.option_b,
        option_c: r.option_c,
        option_d: r.option_d,
        articles: {
          article_number: r.article_number,
          title: r.article_title,
          laws: { short_name: r.law_short_name },
        },
      },
    }))

    return NextResponse.json({ success: true, disputes })
  } catch (error) {
    console.error('❌ [disputes/mine] Error:', (error as Error).message)
    return NextResponse.json({ success: false, error: 'Error cargando impugnaciones' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/disputes/mine', _GET)
