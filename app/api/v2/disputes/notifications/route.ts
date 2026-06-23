// app/api/v2/disputes/notifications/route.ts
// Notificaciones de impugnaciones resueltas/rechazadas/alegadas del usuario
// AUTENTICADO (hook useDisputeNotifications.loadNotifications), normales + psicotécnicas.
//
// AGNÓSTICO (Fase C1): sustituye 2 supabase.from(...).select(embed) de cliente
// (PostgREST+RLS) por Drizzle. Devuelve el MISMO shape anidado que el embed de
// PostgREST (questions→articles→laws) para que el hook conserve su Zod + mapping.
// El user_id sale SIEMPRE del TOKEN verificado → imposible ver impugnaciones ajenas.
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
  const auth = await verifyAuth(request, '/api/v2/disputes/notifications')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  const uid = auth.userId
  const db = getAdminDb()

  // Impugnaciones normales (con el embed questions→articles→laws como objeto JSON).
  // FKs: question_disputes.question_id→questions.id, questions.primary_article_id→
  // articles.id, articles.law_id→laws.id. !inner del original = INNER JOIN.
  const normalRes = await db.execute(sql`
    SELECT qd.id, qd.dispute_type, qd.status, qd.resolved_at, qd.admin_response,
           qd.created_at, qd.is_read, qd.appeal_text, qd.appeal_submitted_at,
           json_build_object(
             'question_text', q.question_text,
             'articles', json_build_object(
               'article_number', a.article_number,
               'laws', json_build_object('short_name', l.short_name)
             )
           ) AS questions
    FROM question_disputes qd
    JOIN questions q ON q.id = qd.question_id
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE qd.user_id = ${uid}::uuid
      AND qd.status IN ('resolved', 'rejected', 'appealed')
      AND qd.resolved_at >= now() - interval '30 days'
      AND qd.is_read = false
    ORDER BY qd.resolved_at DESC
  `)

  // Impugnaciones psicotécnicas (sin embed).
  const psychoRes = await db.execute(sql`
    SELECT id, dispute_type, status, resolved_at, admin_response,
           created_at, is_read, question_id
    FROM psychometric_question_disputes
    WHERE user_id = ${uid}::uuid
      AND status IN ('resolved', 'rejected')
      AND resolved_at >= now() - interval '30 days'
      AND is_read = false
    ORDER BY resolved_at DESC
  `)

  return NextResponse.json({
    success: true,
    disputes: rowsOf(normalRes),
    psychoDisputes: rowsOf(psychoRes),
  })
}

export const GET = withErrorLogging('/api/v2/disputes/notifications', _GET)
