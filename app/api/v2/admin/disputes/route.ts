// app/api/v2/admin/disputes/route.ts - API server-side para gestión de impugnaciones
import { NextRequest, NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { requireAdmin } from '@/lib/api/shared/auth'
import { resolveDispute } from '@/lib/api/v2/dispute'
import { getReadDb } from '@/db/client'
import { psychometricQuestionDisputes, userProfiles, psychometricQuestions } from '@/db/schema'
import { and, inArray, desc, sql } from 'drizzle-orm'

// Mensaje genérico que se envía cuando el admin pulsa "Rechazar" sin texto.
// Coincide literalmente con el mensaje histórico (preserva comportamiento de email
// tras la migración del trigger PG → resolveDispute() in-process).
const GENERIC_REJECT_MESSAGE =
  'Impugnación cerrada por el administrador sin respuesta específica.'

// GET: Cargar todas las impugnaciones con usuarios y preguntas
async function _GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const db = getReadDb()

    // 1. Impugnaciones normales via RPC
    const normalDisputes = (await db.execute(sql`SELECT * FROM get_disputes_with_users_debug()`)) as any[]

    // 2. Impugnaciones psicotécnicas
    const psychoDisputes = await db
      .select({
        id: psychometricQuestionDisputes.id,
        question_id: psychometricQuestionDisputes.questionId,
        user_id: psychometricQuestionDisputes.userId,
        dispute_type: psychometricQuestionDisputes.disputeType,
        description: psychometricQuestionDisputes.description,
        status: psychometricQuestionDisputes.status,
        created_at: psychometricQuestionDisputes.createdAt,
        admin_response: psychometricQuestionDisputes.adminResponse,
        source: psychometricQuestionDisputes.source,
        ai_chat_log_id: psychometricQuestionDisputes.aiChatLogId,
      })
      .from(psychometricQuestionDisputes)
      .orderBy(desc(psychometricQuestionDisputes.createdAt))

    // 3. Enriquecer psicotécnicas con datos de usuario y pregunta
    let enrichedPsychoDisputes: Record<string, unknown>[] = []
    if (psychoDisputes.length > 0) {
      const userIds = [...new Set(psychoDisputes.map(d => d.user_id).filter((id): id is string => !!id))]
      const questionIds = [...new Set(psychoDisputes.map(d => d.question_id).filter((id): id is string => !!id))]

      const userProfilesData = userIds.length > 0
        ? await db.select({ id: userProfiles.id, full_name: userProfiles.fullName, email: userProfiles.email })
            .from(userProfiles).where(inArray(userProfiles.id, userIds))
        : []

      const questions = questionIds.length > 0
        ? await db.select({ id: psychometricQuestions.id, question_text: psychometricQuestions.questionText, question_subtype: psychometricQuestions.questionSubtype })
            .from(psychometricQuestions).where(inArray(psychometricQuestions.id, questionIds))
        : []

      const userMap = new Map(userProfilesData.map(u => [u.id, u]))
      const questionMap = new Map(questions.map(q => [q.id, q]))

      enrichedPsychoDisputes = psychoDisputes.map(d => ({
        ...d,
        isPsychometric: true,
        user_full_name: (d.user_id ? userMap.get(d.user_id)?.full_name : null) || null,
        user_email: (d.user_id ? userMap.get(d.user_id)?.email : null) || null,
        question_text: (d.question_id ? questionMap.get(d.question_id)?.question_text : null) || null,
        question_subtype: (d.question_id ? questionMap.get(d.question_id)?.question_subtype : null) || null,
      }))
    }

    // 4. Obtener usuarios premium
    const allDisputes = [...(normalDisputes || []), ...psychoDisputes]
    let premiumUserIds: string[] = []
    if (allDisputes.length > 0) {
      const userIds = [...new Set(allDisputes.map((d: any) => d.user_id).filter((id: unknown): id is string => !!id))]
      if (userIds.length > 0) {
        const premiumData = await db.select({ id: userProfiles.id })
          .from(userProfiles)
          .where(and(inArray(userProfiles.id, userIds), inArray(userProfiles.planType, ['premium', 'trial'])))
        premiumUserIds = premiumData.map(p => p.id)
      }
    }

    return NextResponse.json({
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normalDisputes: (normalDisputes || []).map((d: any) => ({ ...d, isPsychometric: false })),
      psychometricDisputes: enrichedPsychoDisputes,
      premiumUserIds,
    })
  } catch (error) {
    console.error('Error loading disputes:', error)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

// POST: Cerrar/rechazar una impugnación (sin texto custom)
//
// Ahora delega en resolveDispute() para usar el flujo in-process (Drizzle + sendEmailV2)
// en lugar del antiguo trigger PG → http_post (frágil ante cold starts de Vercel).
// El comportamiento visible para el usuario se preserva: status='rejected', mismo
// admin_response hardcoded y mismo email.
async function _POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin.ok) return admin.response

  try {
    const { disputeId, isPsychometric } = await request.json()

    if (!disputeId) {
      return NextResponse.json({ success: false, error: 'disputeId requerido' }, { status: 400 })
    }

    const result = await resolveDispute({
      disputeId,
      questionType: isPsychometric ? 'psychometric' : 'legislative',
      status: 'rejected',
      adminResponse: GENERIC_REJECT_MESSAGE,
    })

    if (!result.success) {
      const status = result.error.includes('no encontrada') ? 404 :
                     result.error.includes('ya estaba') ? 409 : 500
      return NextResponse.json({ success: false, error: result.error }, { status })
    }

    return NextResponse.json({
      success: true,
      emailSent: result.emailSent,
      emailId: result.emailId,
      emailError: result.emailError,
    })
  } catch (error) {
    console.error('Error closing dispute:', error)
    return NextResponse.json({ success: false, error: 'Error interno' }, { status: 500 })
  }
}

export const GET = withErrorLogging('/api/v2/admin/disputes', _GET)
export const POST = withErrorLogging('/api/v2/admin/disputes', _POST)
