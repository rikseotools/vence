// app/api/admin/lifecycle/queue/route.ts
// Cola de preguntas filtradas por lifecycle_state. Para vista "Por cola" del admin.
//
// GET /api/admin/lifecycle/queue?state=needs_review&limit=50&offset=0
//
// Para state=needs_review/needs_human/quarantine: incluye el ai_verification
// más reciente (no descartado) con explanation_fix, correct_option_should_be,
// correct_article_suggestion → permite "apply fix" en la UI.

import { NextRequest } from 'next/server'
import { z } from 'zod/v3'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { LIFECYCLE_STATES, type LifecycleState } from '@/lib/constants/lifecycleReasons'

const querySchema = z.object({
  state: z.enum(LIFECYCLE_STATES),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  topicNumber: z.coerce.number().int().optional(),  // filtro opcional por tema
})

interface AiVerification {
  ai_provider: string
  ai_model: string | null
  confidence: string | null
  explanation: string | null
  article_ok: boolean | null
  answer_ok: boolean | null
  explanation_ok: boolean | null
  correct_article_suggestion: string | null
  correct_option_should_be: string | null
  explanation_fix: string | null
  verified_at: string
}

interface QueueRow {
  id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string | null
  correct_option: number
  explanation: string
  primary_article_id: string
  lifecycle_state: LifecycleState
  topic_review_status: string | null
  created_at: string
  article_number: string | null
  article_title: string | null
  law_short_name: string | null
  ai_verification: AiVerification | null
}

async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const { searchParams } = new URL(request.url)
  const parsed = querySchema.safeParse({
    state: searchParams.get('state'),
    limit: searchParams.get('limit'),
    offset: searchParams.get('offset'),
    topicNumber: searchParams.get('topicNumber') ?? undefined,
  })
  if (!parsed.success) {
    return Response.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 })
  }
  const { state, limit, offset } = parsed.data

  const db = getDb()

  // Total count para paginación
  const totalResult = await db.execute(sql`
    SELECT count(*)::int AS total FROM public.questions WHERE lifecycle_state = ${state}
  `) as unknown as Array<{ total: number }>
  const total = totalResult[0]?.total ?? 0

  // Preguntas + su última verificación IA no descartada (LATERAL JOIN)
  const rows = await db.execute(sql`
    SELECT
      q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
      q.correct_option, q.explanation, q.primary_article_id,
      q.lifecycle_state, q.topic_review_status, q.created_at,
      a.article_number, a.title AS article_title,
      l.short_name AS law_short_name,
      to_jsonb(av.*) AS ai_verification
    FROM public.questions q
    LEFT JOIN public.articles a ON a.id = q.primary_article_id
    LEFT JOIN public.laws l ON l.id = a.law_id
    LEFT JOIN LATERAL (
      SELECT ai_provider, ai_model, confidence, explanation,
             article_ok, answer_ok, explanation_ok,
             correct_article_suggestion, correct_option_should_be, explanation_fix,
             verified_at
      FROM public.ai_verification_results
      WHERE question_id = q.id AND coalesce(discarded, false) = false
      ORDER BY verified_at DESC
      LIMIT 1
    ) av ON true
    WHERE q.lifecycle_state = ${state}
    ORDER BY q.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `) as unknown as QueueRow[]

  return Response.json({
    success: true,
    state,
    total,
    limit,
    offset,
    questions: rows,
  })
}

export const GET = withErrorLogging('/api/admin/lifecycle/queue', _GET)
