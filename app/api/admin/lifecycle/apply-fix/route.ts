// app/api/admin/lifecycle/apply-fix/route.ts
// Aplica el fix sugerido por la última verificación IA y transiciona la pregunta.
//
// POST body:
//   {
//     questionId: uuid,
//     applyExplanation: bool,    // si true: UPDATE explanation = ai.explanation_fix
//     applyCorrectOption: bool,  // si true: UPDATE correct_option = letterToInt(ai.correct_option_should_be)
//     newState: 'approved' | 'tech_approved'
//   }
//
// Flujo:
//   1. Lee última verificación IA no descartada para la pregunta
//   2. Aplica los UPDATEs solicitados sobre questions
//   3. Llama transition_question_state(_, expected, newState, 'auto_fix_applied', adminId, ai_id)
//   4. El sync via GENERATED column ajusta is_active automáticamente

import { NextRequest } from 'next/server'
import { z } from 'zod/v3'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { invalidateQuestionsCache } from '@/lib/cache/questions'
import { invalidateTestConfigCache } from '@/lib/cache/test-config'

const bodySchema = z.object({
  questionId: z.string().uuid(),
  applyExplanation: z.boolean().default(false),
  applyCorrectOption: z.boolean().default(false),
  newState: z.enum(['approved', 'tech_approved']),
  notes: z.string().max(500).optional(),
})

interface AiVerificationLite {
  id: string
  ai_provider: string
  explanation_fix: string | null
  correct_option_should_be: string | null
}

interface QuestionLite {
  id: string
  lifecycle_state: string
  correct_option: number
  explanation: string
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
  const { questionId, applyExplanation, applyCorrectOption, newState, notes } = parsed.data

  if (!applyExplanation && !applyCorrectOption) {
    return Response.json({
      success: false,
      error: 'Al menos uno de applyExplanation o applyCorrectOption debe ser true',
    }, { status: 400 })
  }

  const db = getDb()

  // 1. Leer última verificación IA + estado actual
  const [question] = await db.execute(sql`
    SELECT id, lifecycle_state, correct_option, explanation
    FROM public.questions WHERE id = ${questionId}::uuid LIMIT 1
  `) as unknown as QuestionLite[]

  if (!question) {
    return Response.json({ success: false, error: 'Pregunta no encontrada' }, { status: 404 })
  }

  const [ai] = await db.execute(sql`
    SELECT id, ai_provider, explanation_fix, correct_option_should_be
    FROM public.ai_verification_results
    WHERE question_id = ${questionId}::uuid AND coalesce(discarded, false) = false
    ORDER BY verified_at DESC LIMIT 1
  `) as unknown as AiVerificationLite[]

  if (!ai) {
    return Response.json({
      success: false,
      error: 'No hay verificación IA disponible para esta pregunta',
    }, { status: 400 })
  }

  // 2. Validar y aplicar fixes
  const updates: { explanation?: string; correct_option?: number } = {}
  const applied: string[] = []

  if (applyExplanation) {
    if (!ai.explanation_fix || ai.explanation_fix.trim().length === 0) {
      return Response.json({
        success: false,
        error: 'IA no sugirió explanation_fix para esta pregunta',
      }, { status: 400 })
    }
    updates.explanation = ai.explanation_fix
    applied.push('explanation')
  }

  if (applyCorrectOption) {
    const newOption = letterToInt(ai.correct_option_should_be)
    if (newOption === null) {
      return Response.json({
        success: false,
        error: `IA no sugirió correct_option_should_be válido (got: ${ai.correct_option_should_be})`,
      }, { status: 400 })
    }
    updates.correct_option = newOption
    applied.push(`correct_option=${ai.correct_option_should_be}`)
  }

  // 3. Aplicar UPDATE de campos editables (NO toca lifecycle_state ni is_active)
  if (updates.explanation !== undefined && updates.correct_option !== undefined) {
    await db.execute(sql`
      UPDATE public.questions
      SET explanation = ${updates.explanation}, correct_option = ${updates.correct_option}
      WHERE id = ${questionId}::uuid
    `)
  } else if (updates.explanation !== undefined) {
    await db.execute(sql`
      UPDATE public.questions SET explanation = ${updates.explanation} WHERE id = ${questionId}::uuid
    `)
  } else if (updates.correct_option !== undefined) {
    await db.execute(sql`
      UPDATE public.questions SET correct_option = ${updates.correct_option} WHERE id = ${questionId}::uuid
    `)
  }

  // Invalidar cache si se modificó algún campo cacheado (tag 'questions').
  // Si solo cambia el lifecycle_state (sin updates de contenido), no invalidar.
  if (updates.explanation !== undefined || updates.correct_option !== undefined) {
    invalidateQuestionsCache()
  }

  // 4. Transición de lifecycle vía función SQL (sync trigger ajusta is_active)
  const noteText = `Apply-fix: ${applied.join(', ')}${notes ? ` — ${notes}` : ''}`
  try {
    await db.execute(sql`
      SELECT public.transition_question_state(
        ${questionId}::uuid,
        ${question.lifecycle_state}::text,
        ${newState}::text,
        'auto_fix_applied'::text,
        ${admin.user.id}::uuid,
        ${ai.id}::uuid,
        ${noteText}::text
      )
    `)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('Same-state') || msg.includes('Illegal transition') || msg.includes('Cannot transition')) {
      return Response.json({ success: false, error: msg, applied }, { status: 400 })
    }
    throw e
  }

  // Lifecycle transition cambia is_active → counts cachados en test-config
  // se invalidan. Coherente con el patrón de transition/route.ts.
  invalidateTestConfigCache()

  return Response.json({
    success: true,
    questionId,
    applied,
    newState,
    aiVerificationId: ai.id,
  })
}

export const POST = withErrorLogging('/api/admin/lifecycle/apply-fix', _POST)
