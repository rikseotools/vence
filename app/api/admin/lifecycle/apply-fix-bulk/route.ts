// app/api/admin/lifecycle/apply-fix-bulk/route.ts
// Versión bulk de apply-fix: aplica fixes a N preguntas en un loop server-side.
// Por pregunta: lee última verificación IA, aplica los fixes solicitados que estén
// disponibles, transiciona a approved/tech_approved. Si no hay fix disponible para
// alguna acción solicitada, la pregunta se reporta en `skipped`.
//
// POST body:
//   {
//     questionIds: uuid[],          // array, max 200 por request
//     applyExplanation: bool,       // si true: aplica explanation_fix donde exista
//     applyCorrectOption: bool,     // si true: aplica correct_option_should_be donde exista
//     newState: 'approved' | 'tech_approved' | 'auto'  // 'auto' = decide por topic_review_status (tech_*)
//   }
//
// Response:
//   {
//     success: true,
//     summary: { total, applied, skipped, failed },
//     applied: [{ questionId, applied: ['explanation', 'correct_option=B'] }],
//     skipped: [{ questionId, reason }],
//     failed: [{ questionId, error }]
//   }

import { NextRequest } from 'next/server'
import { z } from 'zod/v3'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const bodySchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1).max(200),
  applyExplanation: z.boolean().default(false),
  applyCorrectOption: z.boolean().default(false),
  newState: z.enum(['approved', 'tech_approved', 'auto']).default('auto'),
  notes: z.string().max(500).optional(),
})

interface QuestionWithAi {
  id: string
  lifecycle_state: string
  topic_review_status: string | null
  ai_id: string | null
  explanation_fix: string | null
  correct_option_should_be: string | null
}

function letterToInt(letter: string | null | undefined): number | null {
  if (!letter) return null
  const map: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 }
  return map[letter.toUpperCase().trim()] ?? null
}

async function _POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  const body = await request.json().catch(() => null)
  if (!body) return Response.json({ success: false, error: 'JSON inválido' }, { status: 400 })

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ success: false, error: parsed.error.issues[0]?.message }, { status: 400 })
  }
  const { questionIds, applyExplanation, applyCorrectOption, newState: newStateInput, notes } = parsed.data

  if (!applyExplanation && !applyCorrectOption) {
    return Response.json({
      success: false,
      error: 'Al menos uno de applyExplanation o applyCorrectOption debe ser true',
    }, { status: 400 })
  }

  const db = getDb()

  // Cargar todas las preguntas + su última verificación IA en una query
  const rows = await db.execute(sql`
    SELECT
      q.id, q.lifecycle_state, q.topic_review_status,
      av.id AS ai_id, av.explanation_fix, av.correct_option_should_be
    FROM public.questions q
    LEFT JOIN LATERAL (
      SELECT id, explanation_fix, correct_option_should_be
      FROM public.ai_verification_results
      WHERE question_id = q.id AND coalesce(discarded, false) = false
      ORDER BY verified_at DESC LIMIT 1
    ) av ON true
    WHERE q.id = ANY(${questionIds}::uuid[])
  `) as unknown as QuestionWithAi[]

  const found = new Map(rows.map(r => [r.id, r]))

  const applied: Array<{ questionId: string; applied: string[] }> = []
  const skipped: Array<{ questionId: string; reason: string }> = []
  const failed: Array<{ questionId: string; error: string }> = []

  for (const qid of questionIds) {
    const q = found.get(qid)
    if (!q) {
      failed.push({ questionId: qid, error: 'Pregunta no encontrada' })
      continue
    }

    if (!q.ai_id) {
      skipped.push({ questionId: qid, reason: 'Sin verificación IA disponible' })
      continue
    }

    // Decidir qué fixes están disponibles y solicitados
    const willApplyExplanation = applyExplanation && !!q.explanation_fix && q.explanation_fix.trim().length > 0
    const willApplyOption = applyCorrectOption && !!q.correct_option_should_be
    const newOption = willApplyOption ? letterToInt(q.correct_option_should_be) : null

    if (willApplyOption && newOption === null) {
      skipped.push({ questionId: qid, reason: `correct_option_should_be inválido (${q.correct_option_should_be})` })
      continue
    }

    if (!willApplyExplanation && !willApplyOption) {
      skipped.push({ questionId: qid, reason: 'IA no sugiere ninguno de los fixes solicitados' })
      continue
    }

    const appliedList: string[] = []

    try {
      // 1. UPDATE campos editables
      if (willApplyExplanation && willApplyOption) {
        await db.execute(sql`
          UPDATE public.questions
          SET explanation = ${q.explanation_fix}, correct_option = ${newOption}
          WHERE id = ${qid}::uuid
        `)
        appliedList.push('explanation', `correct_option=${q.correct_option_should_be}`)
      } else if (willApplyExplanation) {
        await db.execute(sql`
          UPDATE public.questions SET explanation = ${q.explanation_fix} WHERE id = ${qid}::uuid
        `)
        appliedList.push('explanation')
      } else if (willApplyOption) {
        await db.execute(sql`
          UPDATE public.questions SET correct_option = ${newOption} WHERE id = ${qid}::uuid
        `)
        appliedList.push(`correct_option=${q.correct_option_should_be}`)
      }

      // 2. Decidir estado destino
      let target: 'approved' | 'tech_approved'
      if (newStateInput === 'auto') {
        target = q.topic_review_status?.startsWith('tech_') ? 'tech_approved' : 'approved'
      } else {
        target = newStateInput
      }

      // 3. Transición lifecycle
      const noteText = `Bulk apply-fix: ${appliedList.join(', ')}${notes ? ` — ${notes}` : ''}`
      await db.execute(sql`
        SELECT public.transition_question_state(
          ${qid}::uuid,
          ${q.lifecycle_state}::text,
          ${target}::text,
          'auto_fix_applied'::text,
          ${admin.user.id}::uuid,
          ${q.ai_id}::uuid,
          ${noteText}::text
        )
      `)

      applied.push({ questionId: qid, applied: appliedList })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      failed.push({ questionId: qid, error: msg })
    }
  }

  return Response.json({
    success: true,
    summary: {
      total: questionIds.length,
      applied: applied.length,
      skipped: skipped.length,
      failed: failed.length,
    },
    applied,
    skipped,
    failed,
  })
}

export const POST = withErrorLogging('/api/admin/lifecycle/apply-fix-bulk', _POST)
