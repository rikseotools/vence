// app/api/v2/shared-question/track/route.ts
// Trackea la respuesta a una pregunta COMPARTIDA (página pública /pregunta/[id]).
//
// AGNÓSTICO (Fase C1): sustituye el supabase.from('shared_question_responses')
// INSERT de cliente (PostgREST+RLS) por Drizzle. Auth OPCIONAL (verifyAuthOptional):
// la página es pública, el visitante puede ser anónimo → visitor_user_id sale del
// TOKEN si hay sesión, o null si no (NUNCA del body, para que un anónimo no pueda
// atribuir la respuesta a otro usuario). Best-effort (igual que el original).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuthOptional } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  questionId: z.string().uuid(),
  answerSelected: z.number().int(),
  isCorrect: z.boolean(),
  timeToAnswerMs: z.number().nullable(),
  sourcePlatform: z.string().max(120).nullish(),
  shareMode: z.enum(['quiz', 'educational']),
  referrer: z.string().max(2048).nullable(),
  deviceInfo: z.record(z.string(), z.unknown()).nullable(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  // Auth opcional: anónimo permitido (visitor_user_id null).
  const auth = await verifyAuthOptional(request, '/api/v2/shared-question/track')

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const b = parsed.data

  await getAdminDb().execute(sql`
    INSERT INTO shared_question_responses
      (question_id, answer_selected, is_correct, time_to_answer_ms, source_platform,
       share_mode, referrer, visitor_user_id, device_info)
    VALUES (
      ${b.questionId}::uuid, ${b.answerSelected}, ${b.isCorrect}, ${b.timeToAnswerMs},
      ${b.sourcePlatform ?? null}, ${b.shareMode}, ${b.referrer},
      ${auth?.userId ?? null}, ${b.deviceInfo ? JSON.stringify(b.deviceInfo) : null}::jsonb
    )
  `)

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/shared-question/track', _POST)
